import React, { useState, useEffect, useRef } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, Popconfirm,
  message, Card, Typography, Badge, Empty, Tooltip, Row, Col, Statistic,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, AimOutlined, ReloadOutlined,
  ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined, AppstoreOutlined, CloudServerOutlined,
} from '@ant-design/icons';
import {
  getApps, getEnvs, getFeatures, createFeature, updateFeature, deleteFeature,
} from '../api/feature';
import RuleDrawer from '../components/RuleDrawer';

const { Text } = Typography;

const VALUE_TYPE_OPTIONS = [
  { value: 'boolean', label: 'Boolean' },
  { value: 'string', label: 'String' },
  { value: 'json', label: 'JSON' },
];

const VALUE_TYPE_COLORS = {
  boolean: 'orange',
  string: 'cyan',
  json: 'purple',
};

function FeatureList() {
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [envs, setEnvs] = useState([]);
  const [selectedEnv, setSelectedEnv] = useState(null);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [form] = Form.useForm();

  // Rule drawer
  const [ruleDrawerOpen, setRuleDrawerOpen] = useState(false);
  const [ruleFeature, setRuleFeature] = useState(null);
  const loadIdRef = useRef(0);

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
    if (!selectedApp) return;
    const id = ++loadIdRef.current;
    setLoading(true);
    try {
      const { data } = await getFeatures(selectedApp.id);
      if (loadIdRef.current !== id) return;
      setFeatures(data || []);
    } catch {
      if (loadIdRef.current !== id) return;
      message.error('加载 Feature 失败');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedApp]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingFeature) {
        await updateFeature(editingFeature.id, values);
        message.success('Feature 已更新');
      } else {
        await createFeature({ ...values, app_id: selectedApp.id });
        message.success('Feature 已创建');
      }
      setModalOpen(false);
      form.resetFields();
      setEditingFeature(null);
      load();
    } catch (e) {
      if (e.errorFields) return;
      message.error('保存失败: ' + e.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteFeature(id);
      message.success('Feature 已删除');
      load();
    } catch (e) {
      message.error('删除失败: ' + e.message);
    }
  };

  const openEdit = (record) => {
    setEditingFeature(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingFeature(null);
    form.resetFields();
    form.setFieldsValue({ value_type: 'boolean' });
    setModalOpen(true);
  };

  const openRules = (record) => {
    setRuleFeature(record);
    setRuleDrawerOpen(true);
  };

  // 统计当前 env 下的规则数据
  const getRuleInfo = (feature) => {
    if (!selectedEnv || !feature.targeting_rules) return { total: 0, active: 0 };
    const envRules = feature.targeting_rules.filter(r => r.env_id === selectedEnv.id);
    return { total: envRules.length, active: envRules.filter(r => r.active).length };
  };

  const totalFeatures = features.length;
  const withRules = selectedEnv ? features.filter(f => getRuleInfo(f).active > 0).length : 0;

  const columns = [
    {
      title: 'Feature Key',
      dataIndex: 'key_name',
      ellipsis: true,
      sorter: (a, b) => a.key_name.localeCompare(b.key_name),
      render: (text) => (
        <Space>
          <ExperimentOutlined style={{ color: '#f5a623' }} />
          <Text strong style={{ color: '#bf6c00' }} ellipsis={{ tooltip: text }}>{text}</Text>
        </Space>
      ),
    },
    {
      title: '值类型',
      dataIndex: 'value_type',
      width: 100,
      filters: VALUE_TYPE_OPTIONS.map(o => ({ text: o.label, value: o.value })),
      onFilter: (value, record) => record.value_type === value,
      render: (t) => <Tag color={VALUE_TYPE_COLORS[t] || 'default'}>{t}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      render: (text) => text || <Text type="secondary">—</Text>,
    },
    {
      title: '规则',
      width: 120,
      align: 'center',
      render: (_, record) => {
        if (!selectedEnv) return <Text type="secondary">选择环境</Text>;
        const info = getRuleInfo(record);
        if (info.total === 0) return <Text type="secondary">无规则</Text>;
        return (
          <Space size={4}>
            <Badge count={info.active} style={{ backgroundColor: '#52c41a' }} />
            <Text type="secondary">/ {info.total}</Text>
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      render: (t) => t ? new Date(t).toLocaleString('zh-CN') : '—',
    },
    {
      title: '操作',
      width: 220,
      render: (_, record) => (
        <Space>
          <Tooltip title={selectedEnv ? '管理定向规则' : '请先选择环境'}>
            <Button
              size="small"
              type="primary"
              ghost
              icon={<AimOutlined />}
              disabled={!selectedEnv}
              onClick={() => openRules(record)}
            >
              规则
            </Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="确认删除此 Feature？"
            description="关联的所有规则也会被删除"
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
            <Statistic title="Feature 总数" value={totalFeatures} prefix={<ExperimentOutlined />} valueStyle={{ color: '#f5a623' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderLeft: '3px solid #52c41a' }}>
            <Statistic title="已配规则" value={selectedEnv ? withRules : '—'} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderLeft: '3px solid #ccc' }}>
            <Statistic title="未配规则" value={selectedEnv ? totalFeatures - withRules : '—'} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#999' }} />
          </Card>
        </Col>
      </Row>



      <Card
        title={
          <Space>
            <ExperimentOutlined style={{ color: '#f5a623' }} />
            <span>特性管理</span>
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
              placeholder="选择环境"
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
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建 Feature</Button>
          </Space>
        }
        variant="borderless"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={features}
          loading={loading}
          tableLayout="fixed"
          scroll={{ x: 900 }}
          pagination={features.length > 15 ? { pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 项` } : false}
          locale={{ emptyText: <Empty description="暂无 Feature，点击「新建 Feature」创建" /> }}
        />
      </Card>

      {/* 新建/编辑 Feature 弹窗 */}
      <Modal
        title={editingFeature ? '编辑 Feature' : '新建 Feature'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditingFeature(null); }}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="key_name"
            label="Feature Key"
            rules={[
              { required: true, message: '请输入 Feature Key' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_.-]*$/, message: '字母开头，仅含字母、数字、_、.、-' },
            ]}
            extra="唯一标识，用于 SDK 查询（创建后不可修改）"
          >
            <Input placeholder="如 dark_mode" disabled={!!editingFeature} />
          </Form.Item>
          <Form.Item name="value_type" label="值类型" rules={[{ required: true }]}>
            <Select options={VALUE_TYPE_OPTIONS} disabled={!!editingFeature} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="功能描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 规则抽屉 */}
      <RuleDrawer
        open={ruleDrawerOpen}
        feature={ruleFeature}
        envId={selectedEnv?.id}
        onClose={() => { setRuleDrawerOpen(false); setRuleFeature(null); load(); }}
      />
    </div>
  );
}

export default FeatureList;
