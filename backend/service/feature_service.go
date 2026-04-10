package service

import (
	"encoding/json"
	"hash/fnv"
	"strconv"
	"strings"

	"goflagforge/model"
	"goflagforge/storage"
)

type FeatureService struct {
	Repo *storage.FeatureRepo
}

func NewFeatureService() *FeatureService {
	return &FeatureService{Repo: &storage.FeatureRepo{}}
}

// EvalContext 客户端传入的求值上下文
type EvalContext struct {
	UserID   string            `json:"user_id"`
	Version  string            `json:"version"`
	Platform string            `json:"platform"`
	Attrs    map[string]string `json:"attrs"` // 扩展属性
}

// FeatureEvalResult 单个 feature 的求值结果
type FeatureEvalResult struct {
	Enabled bool   `json:"enabled"`
	Value   string `json:"value,omitempty"`
}

// EvaluateFeatures 根据 app/env + 上下文求值所有 feature
// 优先级：用户覆盖 > 定向规则 > 基线规则
func (s *FeatureService) EvaluateFeatures(appKey, envKey string, ctx EvalContext) (map[string]FeatureEvalResult, error) {
	app, err := s.Repo.FindAppByKey(appKey)
	if err != nil {
		return nil, err
	}
	env, err := s.Repo.FindEnvByAppAndKey(app.ID, envKey)
	if err != nil {
		return nil, err
	}
	features, err := s.Repo.FindByAppWithRulesForEnv(app.ID, env.ID)
	if err != nil {
		return nil, err
	}

	// 加载用户级覆盖（如有 user_id）
	overrideMap := make(map[uint]model.UserFeatureOverride)
	if ctx.UserID != "" {
		overrides, err := s.Repo.FindOverridesByUser(app.ID, env.ID, ctx.UserID)
		if err == nil {
			for _, o := range overrides {
				overrideMap[o.FeatureID] = o
			}
		}
	}

	result := make(map[string]FeatureEvalResult, len(features))
	for _, f := range features {
		// 1. 用户覆盖优先
		if o, ok := overrideMap[f.ID]; ok {
			result[f.KeyName] = FeatureEvalResult{Enabled: o.Enabled, Value: o.Value}
			continue
		}
		// 2. 定向规则求值
		er := FeatureEvalResult{Enabled: false}
		for _, rule := range f.TargetingRules {
			if matchRule(rule, f.KeyName, ctx) {
				er.Enabled = rule.Enabled
				er.Value = rule.Value
				break
			}
		}
		result[f.KeyName] = er
	}
	return result, nil
}

// ListAll 列出 feature（appID=0 时列出全部）
func (s *FeatureService) ListAll(appID uint) ([]model.Feature, error) {
	return s.Repo.FindAll(appID)
}

func (s *FeatureService) GetByID(id uint) (*model.Feature, error) {
	return s.Repo.FindByID(id)
}

func (s *FeatureService) Create(feature *model.Feature) error {
	return s.Repo.Create(feature)
}

func (s *FeatureService) Update(feature *model.Feature) error {
	return s.Repo.Update(feature)
}

func (s *FeatureService) Delete(id uint) error {
	return s.Repo.Delete(id)
}

// ---- Targeting Rule CRUD ----

func (s *FeatureService) CreateRule(rule *model.FeatureTargetingRule) error {
	return s.Repo.CreateRule(rule)
}

func (s *FeatureService) UpdateRule(rule *model.FeatureTargetingRule) error {
	return s.Repo.UpdateRule(rule)
}

func (s *FeatureService) DeleteRule(id uint) error {
	return s.Repo.DeleteRule(id)
}

// ---- App / Env ----

func (s *FeatureService) ListApps() ([]model.App, error) { return s.Repo.ListApps() }
func (s *FeatureService) CreateApp(app *model.App) error { return s.Repo.CreateApp(app) }
func (s *FeatureService) ListEnvs(appID uint) ([]model.Environment, error) {
	return s.Repo.ListEnvsByApp(appID)
}
func (s *FeatureService) CreateEnv(env *model.Environment) error { return s.Repo.CreateEnv(env) }

// ---- User Feature Override ----

func (s *FeatureService) UpsertOverride(o *model.UserFeatureOverride) error {
	return s.Repo.UpsertOverride(o)
}

func (s *FeatureService) DeleteOverride(appID, envID, featureID uint, userID string) error {
	return s.Repo.DeleteOverride(appID, envID, featureID, userID)
}

func (s *FeatureService) ListOverrides(appID, envID uint, userID string) ([]model.UserFeatureOverride, error) {
	return s.Repo.FindOverridesByUser(appID, envID, userID)
}

// ============================================================
// 规则引擎：递归条件树，支持 AND / OR 嵌套
// ============================================================
//
// ConditionNode 是一个递归结构，可以是：
//   叶子节点: {"type":"user_list","value":["alice"]}
//   组合节点: {"op":"and","items":[...]}  或 {"op":"or","items":[...]}
//
// 向后兼容：裸数组 [...] 等价于 {"op":"and","items":[...]}
// 空/[] = match all（基线规则）

// ConditionNode 条件树节点
type ConditionNode struct {
	// 组合节点字段
	Op    string          `json:"op,omitempty"`    // "and" / "or"，叶子节点为空
	Items []ConditionNode `json:"items,omitempty"` // 子节点列表

	// 叶子节点字段
	Type  string          `json:"type,omitempty"`  // user_list / percentage / version / platform / attr
	Value json.RawMessage `json:"value,omitempty"` // 具体值
}

func (n *ConditionNode) isGroup() bool {
	return n.Op != ""
}

// parseConditions 解析 conditions JSON，兼容裸数组和对象两种格式
func parseConditions(raw string) (*ConditionNode, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || trimmed == "[]" || trimmed == "null" {
		return nil, nil // match all
	}

	// 尝试解析为裸数组（向后兼容）
	if trimmed[0] == '[' {
		var items []ConditionNode
		if err := json.Unmarshal([]byte(trimmed), &items); err != nil {
			return nil, err
		}
		return &ConditionNode{Op: "and", Items: items}, nil
	}

	// 解析为对象（组合节点或叶子节点）
	var node ConditionNode
	if err := json.Unmarshal([]byte(trimmed), &node); err != nil {
		return nil, err
	}
	return &node, nil
}

// matchRule 判断一条规则是否命中，featureKey 用作灰度 hash 盐
func matchRule(rule model.FeatureTargetingRule, featureKey string, ctx EvalContext) bool {
	root, err := parseConditions(rule.Conditions)
	if err != nil {
		return false
	}
	if root == nil {
		return true // 空条件 = match all（基线规则）
	}
	return evalNode(*root, featureKey, ctx)
}

// evalNode 递归求值条件树
func evalNode(node ConditionNode, featureKey string, ctx EvalContext) bool {
	if node.isGroup() {
		switch strings.ToLower(node.Op) {
		case "and":
			for _, child := range node.Items {
				if !evalNode(child, featureKey, ctx) {
					return false
				}
			}
			return true
		case "or":
			for _, child := range node.Items {
				if evalNode(child, featureKey, ctx) {
					return true
				}
			}
			return false
		default:
			return false
		}
	}
	// 叶子节点
	return matchLeaf(node, featureKey, ctx)
}

// matchLeaf 叶子条件求值
func matchLeaf(node ConditionNode, featureKey string, ctx EvalContext) bool {
	switch node.Type {
	case "user_list":
		return matchUserList(node.Value, ctx.UserID)
	case "percentage":
		return matchPercentage(node.Value, ctx.UserID, featureKey)
	case "version":
		return matchVersion(node.Value, ctx.Version)
	case "platform":
		return matchStringEquals(node.Value, ctx.Platform)
	case "attr":
		return matchAttr(node.Value, ctx.Attrs)
	default:
		return false
	}
}

// matchUserList 白名单：value = ["alice","bob"]
func matchUserList(raw json.RawMessage, userID string) bool {
	if userID == "" {
		return false
	}
	var users []string
	if err := json.Unmarshal(raw, &users); err != nil {
		return false
	}
	for _, u := range users {
		if u == userID {
			return true
		}
	}
	return false
}

// matchPercentage 灰度百分比
// value 支持两种格式：
//
//	简单: 30                            → 使用 featureKey 作为 rollout key
//	自定义: {"pct":30,"key":"exp_abc"}  → 使用自定义 rollout key
func matchPercentage(raw json.RawMessage, userID, featureKey string) bool {
	if userID == "" {
		return false
	}
	var pct float64
	rolloutKey := featureKey

	// 尝试解析为带 key 的对象
	var obj struct {
		Pct float64 `json:"pct"`
		Key string  `json:"key"`
	}
	if err := json.Unmarshal(raw, &obj); err == nil && obj.Pct > 0 {
		pct = obj.Pct
		if obj.Key != "" {
			rolloutKey = obj.Key
		}
	} else {
		// 简单数值
		if err := json.Unmarshal(raw, &pct); err != nil {
			return false
		}
	}

	h := fnv.New32a()
	h.Write([]byte(rolloutKey))
	h.Write([]byte{0}) // separator
	h.Write([]byte(userID))
	return float64(h.Sum32()%100) < pct
}

// matchVersion 版本约束：value = ">=2.0.0"
func matchVersion(raw json.RawMessage, current string) bool {
	current = strings.TrimSpace(current)
	if current == "" {
		return false
	}
	var constraint string
	if err := json.Unmarshal(raw, &constraint); err != nil {
		return false
	}
	constraint = strings.TrimSpace(constraint)
	if constraint == "" {
		return false
	}

	var op, target string
	switch {
	case strings.HasPrefix(constraint, ">="):
		op, target = ">=", strings.TrimSpace(constraint[2:])
	case strings.HasPrefix(constraint, "<="):
		op, target = "<=", strings.TrimSpace(constraint[2:])
	case strings.HasPrefix(constraint, ">"):
		op, target = ">", strings.TrimSpace(constraint[1:])
	case strings.HasPrefix(constraint, "<"):
		op, target = "<", strings.TrimSpace(constraint[1:])
	case strings.HasPrefix(constraint, "="):
		op, target = "=", strings.TrimSpace(constraint[1:])
	default:
		op, target = "=", constraint
	}

	cmp := compareVersions(current, target)
	switch op {
	case ">=":
		return cmp >= 0
	case "<=":
		return cmp <= 0
	case ">":
		return cmp > 0
	case "<":
		return cmp < 0
	case "=":
		return cmp == 0
	}
	return false
}

// matchStringEquals 精确匹配：value = "ios"
func matchStringEquals(raw json.RawMessage, actual string) bool {
	var expected string
	if err := json.Unmarshal(raw, &expected); err != nil {
		return false
	}
	return strings.EqualFold(expected, actual)
}

// matchAttr 扩展属性匹配：value = {"key":"region","value":"cn"}
func matchAttr(raw json.RawMessage, attrs map[string]string) bool {
	var kv struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if err := json.Unmarshal(raw, &kv); err != nil {
		return false
	}
	return strings.EqualFold(attrs[kv.Key], kv.Value)
}

func compareVersions(a, b string) int {
	partsA := strings.Split(a, ".")
	partsB := strings.Split(b, ".")
	maxLen := len(partsA)
	if len(partsB) > maxLen {
		maxLen = len(partsB)
	}
	for i := 0; i < maxLen; i++ {
		var va, vb int
		if i < len(partsA) {
			va, _ = strconv.Atoi(partsA[i])
		}
		if i < len(partsB) {
			vb, _ = strconv.Atoi(partsB[i])
		}
		if va < vb {
			return -1
		}
		if va > vb {
			return 1
		}
	}
	return 0
}
