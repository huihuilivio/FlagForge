import React, { useState, useEffect, useRef } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Switch, Select,
  Space, Popconfirm, Card, Tag, message, Typography, Empty, Tooltip,
  Row, Col, Statistic, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  AimOutlined, CheckCircleOutlined, CloseCircleOutlined,
  AppstoreOutlined, CloudServerOutlined,
} from '@ant-design/icons';
import { getApps, getEnvs, getRules, getFeatures, createRule, updateRule, deleteRule } from '../api/feature';
import ConditionEditor from '../components/ConditionEditor';
import { parseConditions } from '../utils/conditions';

const { Text } = Typography;

function RuleManage() {
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [envs, setEnvs] = useState([]);
  const [selectedEnv, setSelectedEnv] = useState(null);
  const [rules, setRules] = useState([]);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [conditions, setConditions] = useState([]);
  const [form] = Form.useForm();
  const loadIdRef = useRef(0);

  // 筛选
  const [filterFeatureId, setFilterFeatureId] = useState(null);

  useEffect(() => {
    getApps().then(({ data }) => setApps(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedApp) {
      getEnvs(selectedApp.id).then(({ data }) => { setEnvs(data || []); setSelectedEnv(null); }).catch(() => {});
    } else {
      setEnvs([]); setSelectedEnv(null);
    }
  }, [selectedApp]);

  const load = async () => {
    if (!selectedApp) { setRules([]); return; }
    const id = ++loadIdRef.current;
    setLoading(true);
    try {
      const params = { app_id: selectedApp.id };
      if (selectedEnv) params.env_id = selectedEnv.id;
      if (filterFeatureId) params.feature_id = filterFeatureId;
      const { data } = await getRules(params);
      if (loadIdRef.current !== id) return;
      setRules(data || []);
    } catch {
      if (loadIdRef.current !== id) return;
      message.error('加载规则列表失败');
    }
    setLoading(false);
  };

  const loadFeatures = async () => {
    if (!selectedApp) { setFeatures([]); return; }
    try {
      const { data } = await getFeatures(selectedApp.id);
      setFeatures(data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadFeatures(); }, [selectedApp]);
  useEffect(() => { load(); }, [selectedApp, selectedEnv, filterFeatureId]);

  const featureMap = {};
  features.forEach(f => { featureMap[f.id] = f; });

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const body = {
        feature_id: values.feature_id,
        env_id: values.env_id,
        name: values.name || '',
        priority: values.priority ?? 0,
        active: values.active ?? true,
        conditions: JSON.stringify(conditions.length > 0 ? conditions : []),
        enabled: values.enabled ?? false,
        value: values.value || '',
      };
      if (editing) {
        await updateRule(editing.id, body);
        message.success('规则已更新');
      } else {
        await createRule(body);
        message.success('规则已创建');
      }
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      load();
    } catch (e) {
      if (e.errorFields) return;
      message.error('保存失败: ' + e.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRule(id);
      message.success('规则已删除');
      load();
    } catch (e) {
      message.error('删除失败: ' + e.message);
    }
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      feature_id: record.feature_id,
      env_id: record.env_id,
      name: record.name,
      priority: record.priority,
      active: record.active,
      enabled: record.enabled,
      value: record.value,
    });
    const { conditions: parsed, error } = parseConditions(record.conditions);
    if (error) message.warning('条件数据解析失败，已重置为空');
    setConditions(parsed);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setConditions([]);
    form.resetFields();
    form.setFieldsValue({
      priority: rules.length * 10,
      active: true,
      enabled: true,
      env_id: selectedEnv?.id,
    });
    setModalOpen(true);
  };

  const activeRules = rules.filter(r => r.active).length;
  const inactiveRules = rules.length - activeRules;

  const columns = [
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      align: 'center',
      sorter: (a, b) => a.priority - b.priority,
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: 'Feature',
      dataIndex: 'feature_id',
      width: 160,
      ellipsis: true,
      render: (id) => {
        const f = featureMap[id];
        return f
          ? <Text strong style={{ color: '#bf6c00' }} ellipsis={{ tooltip: f.key_name }}>{f.key_name}</Text>
          : <Text type="secondary">#{id}</Text>;
      },
      filters: features.map(f => ({ text: f.key_name, value: f.id })),
      onFilter: (value, record) => record.feature_id === value,
    },
    {
      title: '环境',
      dataIndex: 'env',
      width: 130,
      ellipsis: true,
      render: (env) => env
        ? <Tooltip title={env.name || env.env_key}><Tag color="blue" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{env.name || env.env_key}</Tag></Tooltip>
        : <Text type="secondary">—</Text>,
    },
    {
      title: '规则名称',
      dataIndex: 'name',
      ellipsis: true,
      render: (t) => t || <Text type="secondary">（未命名）</Text>,
    },
    {
      title: '状态',
      width: 80,
      align: 'center',
      filters: [{ text: '启用', value: true }, { text: '禁用', value: false }],
      onFilter: (value, record) => record.active === value,
      render: (_, r) => r.active
        ? <Tag color="green">启用</Tag>
        : <Tag color="default">禁用</Tag>,
    },
    {
      title: '命中结果',
      width: 110,
      render: (_, r) => (
        <Space size={4}>
          {r.enabled ? <Tag color="orange">ON</Tag> : <Tag>OFF</Tag>}
          {r.value && <Tooltip title={r.value}><Text type="secondary" ellipsis style={{ maxWidth: 60 }}>= {r.value}</Text></Tooltip>}
        </Space>
      ),
    },
    {
      title: '条件数',
      width: 80,
      align: 'center',
      render: (_, r) => {
        const { conditions: items } = parseConditions(r.conditions);
        return items.length === 0
          ? <Text type="secondary">match-all</Text>
          : <Badge count={items.length} style={{ backgroundColor: '#f5a623' }} />;
      },
    },
    {
      title: '操作',
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="确认删除此规则？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 统计 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card size="small" style={{ borderLeft: '3px solid #f5a623' }}>
            <Statistic title="规则总数" value={rules.length} prefix={<AimOutlined />} valueStyle={{ color: '#f5a623' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderLeft: '3px solid #52c41a' }}>
            <Statistic title="已启用" value={activeRules} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderLeft: '3px solid #ccc' }}>
            <Statistic title="已禁用" value={inactiveRules} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#999' }} />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <AimOutlined style={{ color: '#f5a623' }} />
            <span>规则管理</span>
            <Select
              style={{ width: 160 }}
              value={selectedApp?.id}
              options={apps.map(a => ({ value: a.id, label: a.name || a.app_key }))}
              onChange={(id) => setSelectedApp(apps.find(a => a.id === id))}
              suffixIcon={<AppstoreOutlined />}
            />
            <Select
              style={{ width: 160 }}
              value={selectedEnv?.id}
              placeholder="全部环境"
              allowClear
              options={envs.map(e => ({ value: e.id, label: e.name || e.env_key }))}
              onChange={(id) => setSelectedEnv(id ? envs.find(e => e.id === id) : null)}
              suffixIcon={<CloudServerOutlined />}
            />
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建规则</Button>
          </Space>
        }
        variant="borderless"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rules}
          loading={loading}
          tableLayout="fixed"
          scroll={{ x: 850 }}
          pagination={rules.length > 15 ? { pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 项` } : false}
          size="middle"
          locale={{ emptyText: <Empty description="暂无规则" /> }}
        />
      </Card>

      <div style={{ marginTop: 16, padding: '12px 16px', background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f' }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          💡 规则按优先级从小到大求值，首条命中即终止。空条件（[]）= match all（基线规则），建议放最低优先级。
        </Text>
      </div>

      {/* 新建/编辑规则弹窗 */}
      <Modal
        title={editing ? '编辑规则' : '新建规则'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        okText="保存"
        cancelText="取消"
        width={680}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="feature_id" label="Feature" style={{ flex: 1 }} rules={[{ required: true, message: '请选择 Feature' }]}>
              <Select
                placeholder="选择 Feature"
                options={features.map(f => ({ value: f.id, label: f.key_name }))}
                showSearch
                optionFilterProp="label"
                disabled={!!editing}
              />
            </Form.Item>
            <Form.Item name="env_id" label="环境" style={{ width: 160 }} rules={[{ required: true, message: '请选择环境' }]}>
              <Select
                placeholder="选择环境"
                options={(envs || []).map(e => ({ value: e.id, label: e.name || e.env_key }))}
                disabled={!!editing}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="name" label="规则名称" style={{ flex: 1 }}>
              <Input placeholder="如 VIP 用户" />
            </Form.Item>
            <Form.Item name="priority" label="优先级" style={{ width: 100 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 24 }}>
            <Form.Item name="active" label="启用规则" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="enabled" label="命中时开启 Feature" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>

          <Form.Item name="value" label="命中时返回值（可选）">
            <Input placeholder="string / json 类型 feature 使用" />
          </Form.Item>

          <Form.Item label="条件（Conditions）">
            <ConditionEditor conditions={conditions} onChange={setConditions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RuleManage;
