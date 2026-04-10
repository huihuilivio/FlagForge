import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Space, Popconfirm, Card, Tag,
  message, Typography, Empty, Statistic, Row, Col, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  AppstoreOutlined, CloudServerOutlined, FlagOutlined,
} from '@ant-design/icons';
import { getApps, createApp, updateApp, deleteApp, getEnvs, getFeatures } from '../api/feature';

const { Text, Paragraph } = Typography;

function AppManage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [stats, setStats] = useState({}); // { appId: { envCount, featureCount } }

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getApps();
      const list = data || [];
      setApps(list);
      // 并行加载每个 app 的统计
      const statsMap = {};
      await Promise.all(
        list.map(async (app) => {
          try {
            const [envRes, featRes] = await Promise.all([
              getEnvs(app.id),
              getFeatures(app.id),
            ]);
            statsMap[app.id] = {
              envCount: envRes.data?.length || 0,
              featureCount: featRes.data?.length || 0,
            };
          } catch {
            statsMap[app.id] = { envCount: 0, featureCount: 0 };
          }
        })
      );
      setStats(statsMap);
    } catch {
      message.error('加载应用列表失败');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateApp(editing.id, values);
        message.success('应用已更新');
      } else {
        await createApp(values);
        message.success('应用已创建');
      }
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      load();
    } catch { /* validate */ }
  };

  const handleDelete = async (id) => {
    await deleteApp(id);
    message.success('应用已删除');
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
    setModalOpen(true);
  };

  // 顶部统计
  const totalApps = apps.length;
  const totalEnvs = Object.values(stats).reduce((s, v) => s + v.envCount, 0);
  const totalFeatures = Object.values(stats).reduce((s, v) => s + v.featureCount, 0);

  const columns = [
    {
      title: '应用标识',
      dataIndex: 'app_key',
      width: 160,
      render: (text) => (
        <Space>
          <AppstoreOutlined style={{ color: '#f5a623' }} />
          <Text strong style={{ color: '#bf6c00' }}>{text}</Text>
        </Space>
      ),
    },
    {
      title: '应用名称',
      dataIndex: 'name',
      width: 180,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      render: (text) => text || <Text type="secondary">—</Text>,
    },
    {
      title: '环境数',
      width: 80,
      align: 'center',
      render: (_, record) => {
        const cnt = stats[record.id]?.envCount ?? '—';
        return <Tag color="blue">{cnt}</Tag>;
      },
    },
    {
      title: 'Feature 数',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const cnt = stats[record.id]?.featureCount ?? '—';
        return <Tag color="orange">{cnt}</Tag>;
      },
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
            title="确认删除此应用？"
            description="关联的环境和 Feature 也会被删除"
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
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card size="small" style={{ borderLeft: '3px solid #f5a623' }}>
            <Statistic title="应用总数" value={totalApps} prefix={<AppstoreOutlined />} valueStyle={{ color: '#f5a623' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderLeft: '3px solid #1890ff' }}>
            <Statistic title="环境总数" value={totalEnvs} prefix={<CloudServerOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderLeft: '3px solid #52c41a' }}>
            <Statistic title="Feature 总数" value={totalFeatures} prefix={<FlagOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      {/* 表格 */}
      <Card
        title={<span><AppstoreOutlined style={{ color: '#f5a623', marginRight: 8 }} />应用管理</span>}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建应用</Button>
          </Space>
        }
        variant="borderless"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={apps}
          loading={loading}
          pagination={apps.length > 10 ? { pageSize: 10, showSizeChanger: true } : false}
          locale={{ emptyText: <Empty description="暂无应用，点击「新建应用」创建第一个" /> }}
        />
      </Card>

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editing ? '编辑应用' : '新建应用'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="app_key"
            label="应用标识"
            rules={[
              { required: true, message: '请输入应用标识' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/, message: '字母开头，仅含字母、数字、_、-' },
            ]}
            extra="唯一标识，用于 SDK 接入（创建后不可修改）"
          >
            <Input placeholder="如 my_app" disabled={!!editing} />
          </Form.Item>
          <Form.Item
            name="name"
            label="应用名称"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input placeholder="如 我的应用" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="应用用途说明（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default AppManage;
