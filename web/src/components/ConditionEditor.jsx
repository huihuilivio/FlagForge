import React from 'react';
import { Button, Select, Input, InputNumber, Space, Card, Tag, Typography, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

const CONDITION_TYPES = [
  { value: 'user_list', label: '用户白名单 (user_list)' },
  { value: 'percentage', label: '灰度百分比 (percentage)' },
  { value: 'version', label: '版本约束 (version)' },
  { value: 'platform', label: '平台 (platform)' },
  { value: 'attr', label: '扩展属性 (attr)' },
];

const MAX_CONDITIONS = 20;

/**
 * 简化条件编辑器：编辑一个隐式 AND 数组
 * conditions: [{type, value}, ...]
 * onChange: (newConditions) => void
 */
function ConditionEditor({ conditions = [], onChange }) {
  const add = () => {
    if (conditions.length >= MAX_CONDITIONS) {
      message.warning(`最多添加 ${MAX_CONDITIONS} 个条件`);
      return;
    }
    onChange([...conditions, { type: 'user_list', value: [] }]);
  };

  const remove = (index) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const update = (index, field, val) => {
    const next = [...conditions];
    next[index] = { ...next[index], [field]: val };
    onChange(next);
  };

  const updateValue = (index, val) => {
    const next = [...conditions];
    next[index] = { ...next[index], value: val };
    onChange(next);
  };

  return (
    <div>
      {conditions.length === 0 && (
        <div style={{ padding: '8px 0', color: '#999', fontSize: 13 }}>
          空条件 = match all（基线规则），适合放在最低优先级。
        </div>
      )}

      {conditions.map((cond, i) => (
        <Card
          key={i}
          size="small"
          style={{ marginBottom: 8, background: '#fffdf5', border: '1px solid #ffecc7' }}
          styles={{ body: { padding: '8px 12px' } }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Select
              size="small"
              style={{ width: 200 }}
              value={cond.type}
              onChange={(v) => {
                const defaults = {
                  user_list: [],
                  percentage: 30,
                  version: '>=1.0.0',
                  platform: 'ios',
                  attr: { key: '', value: '' },
                };
                const next = [...conditions];
                next[i] = { type: v, value: defaults[v] ?? '' };
                onChange(next);
              }}
              options={CONDITION_TYPES}
            />

            <div style={{ flex: 1 }}>
              <ConditionValueEditor
                type={cond.type}
                value={cond.value}
                onChange={(v) => updateValue(i, v)}
              />
            </div>

            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => remove(i)}
            />
          </div>
          {i < conditions.length - 1 && (
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <Tag color="orange" style={{ fontSize: 11 }}>AND</Tag>
            </div>
          )}
        </Card>
      ))}

      <Button type="dashed" icon={<PlusOutlined />} onClick={add} block size="small">
        添加条件
      </Button>
    </div>
  );
}

function ConditionValueEditor({ type, value, onChange }) {
  switch (type) {
    case 'user_list': {
      const users = Array.isArray(value) ? value : [];
      return (
        <Select
          mode="tags"
          size="small"
          style={{ width: '100%' }}
          placeholder="输入用户 ID 后回车"
          value={users}
          onChange={onChange}
          tokenSeparators={[',']}
        />
      );
    }
    case 'percentage': {
      const pct = typeof value === 'number' ? value : (value?.pct ?? 30);
      return (
        <InputNumber
          size="small"
          min={0}
          max={100}
          value={pct}
          onChange={(v) => onChange(v ?? 0)}
          addonAfter="%"
          style={{ width: 140 }}
        />
      );
    }
    case 'version': {
      const str = typeof value === 'string' ? value : '>=1.0.0';
      const valid = /^[><=!]{0,2}\d+(\.\d+){0,2}(-[\w.]+)?$/.test(str);
      return (
        <Space>
          <Input
            size="small"
            value={str}
            onChange={(e) => onChange(e.target.value)}
            placeholder="如 >=2.0.0"
            style={{ width: 200 }}
            status={str && !valid ? 'warning' : undefined}
          />
          {str && !valid && <Text type="warning" style={{ fontSize: 11, color: '#faad14' }}>{'格式: >=1.0.0'}</Text>}
        </Space>
      );
    }
    case 'platform': {
      const str = typeof value === 'string' ? value : '';
      return (
        <Select
          size="small"
          style={{ width: 160 }}
          value={str}
          onChange={onChange}
          options={[
            { value: 'ios', label: 'iOS' },
            { value: 'android', label: 'Android' },
            { value: 'windows', label: 'Windows' },
            { value: 'macos', label: 'macOS' },
            { value: 'linux', label: 'Linux' },
            { value: 'web', label: 'Web' },
          ]}
          showSearch
          allowClear
          placeholder="选择平台"
        />
      );
    }
    case 'attr': {
      const kv = (typeof value === 'object' && value !== null && !Array.isArray(value))
        ? value
        : { key: '', value: '' };
      return (
        <Space size={4}>
          <Input
            size="small"
            style={{ width: 120 }}
            value={kv.key}
            onChange={(e) => onChange({ ...kv, key: e.target.value })}
            placeholder="属性名"
          />
          <Text type="secondary">=</Text>
          <Input
            size="small"
            style={{ width: 120 }}
            value={kv.value}
            onChange={(e) => onChange({ ...kv, value: e.target.value })}
            placeholder="属性值"
          />
        </Space>
      );
    }
    default:
      return <Input size="small" value={JSON.stringify(value)} onChange={(e) => {
        try { onChange(JSON.parse(e.target.value)); } catch { onChange(e.target.value); }
      }} />;
  }
}

export default ConditionEditor;
