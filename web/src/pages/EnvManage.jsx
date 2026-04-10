import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Switch, Space, Popconfirm,
  Card, Tag, message, Typography, Empty, Tooltip, Select,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  CloudServerOutlined, SafetyCertificateOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import { getApps, getEnvs, createEnv, updateEnv, deleteEnv } from '../api/feature';

const { Text } = Typography;

function EnvManage() {
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [envs, setEnvs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    getApps().then(({ data }) => setApps(data || [])).catch(() => {});
  }, []);

  const load = async () => {
    if (!selectedApp) { setEnvs([]); return; }
    setLoading(true);
    try {
      const { data } = await getEnvs(selectedApp.id);
      setEnvs(data || []);
    } catch {
      message.error('加载环境列表失败');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedApp]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateEnv(editing.id, { ...values, app_id: selectedApp.id });
        message.success('环境已更新');
      } else {
        await createEnv(selectedApp.id, values);
        message.success('环境已创建');
      }
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      load();
    } catch { /* validate */ }
  };

  const handleDelete = async (id) => {
    await deleteEnv(id);
    message.success('环境已删除');
    load();
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ sort_order: envs.length * 10, is_production: false });
    setModalOpen(true);
  };

  const columns = [
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 70,
      align: 'center',
      render: (v) => <Text type="secondary">{v}</Text>,
    },
    {
      title: '环境标识',
      dataIndex: 'env_key',
      width: 150,
      render: (text) => (
        <Space>
          <CloudServerOutlined style={{ color: '#1890ff' }} />
          <Text strong style={{ color: '#1890ff' }}>{text}</Text>
        </Space>
      ),
    },
    {
      title: '环境名称',
      dataIndex: 'name',
      width: 180,
      render: (text) => text || <Text type="secondary">—</Text>,
    },
    {
      title: '生产环境',
      dataIndex: 'is_production',
      width: 100,
      align: 'center',
      render: (v) => v
        ? <Tag icon={<SafetyCertificateOutlined />} color="red">生产</Tag>
        : <Tag color="default">非生产</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (t) => t ? new Date(t).toLocaleString('zh-CN') : '—',
    },
    {
      title: '操作',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="确认删除此环境？"
            description={record.is_production ? '⚠️ 这是生产环境，请谨慎操作' : '关联的规则也会被删除'}
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
      <Card
        title={
          <Space>
            <CloudServerOutlined style={{ color: '#1890ff' }} />
            <span>环境管理</span>
            <Select
              style={{ width: 200 }}
              size="small"
              value={selectedApp?.id}
              onChange={(id) => setSelectedApp(apps.find(a => a.id === id))}
              options={apps.map(a => ({ value: a.id, label: a.name || a.app_key }))}
              showSearch
              optionFilterProp="label"
            />
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建环境</Button>
          </Space>
        }
        variant="borderless"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={envs}
          loading={loading}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无环境，点击「新建环境」开始配置" /> }}
        />
      </Card>

      <div style={{ marginTop: 16, padding: '12px 16px', background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f' }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          💡 <strong>提示</strong>：建议创建 <Tag>dev</Tag> <Tag>staging</Tag> <Tag>prod</Tag> 三个标准环境。
          生产环境会在删除时额外提示确认。排序值越小越靠前。
        </Text>
      </div>

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editing ? '编辑环境' : '新建环境'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="env_key"
            label="环境标识"
            rules={[
              { required: true, message: '请输入环境标识' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/, message: '字母开头，仅含字母、数字、_、-' },
            ]}
            extra="唯一标识，用于 SDK 接入（创建后不可修改）"
          >
            <Input placeholder="如 dev / staging / prod" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="name" label="环境名称">
            <Input placeholder="如 开发环境" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 24 }}>
            <Form.Item name="sort_order" label="排序" style={{ width: 120 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="is_production" label="生产环境" valuePropName="checked">
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default EnvManage;
