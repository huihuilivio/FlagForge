import React, { useState, useEffect } from 'react';
import {
  Drawer, Table, Button, Modal, Form, Input, InputNumber, Switch,
  Select, Space, Popconfirm, Tag, message, Typography, Empty, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import { createRule, updateRule, deleteRule } from '../api/feature';
import ConditionEditor from './ConditionEditor';

const { Text } = Typography;

function RuleDrawer({ open, feature, envId, onClose }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [form] = Form.useForm();
  const [conditions, setConditions] = useState([]);

  // 当前 env 下的规则
  const rules = (feature?.targeting_rules || [])
    .filter(r => r.env_id === envId)
    .sort((a, b) => a.priority - b.priority || a.id - b.id);

  const openCreate = () => {
    setEditingRule(null);
    setConditions([]);
    form.resetFields();
    form.setFieldsValue({ priority: rules.length * 10, active: true, enabled: true });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditingRule(record);
    form.setFieldsValue({
      name: record.name,
      priority: record.priority,
      active: record.active,
      enabled: record.enabled,
      value: record.value,
    });
    // 解析 conditions
    try {
      const parsed = JSON.parse(record.conditions || '[]');
      if (Array.isArray(parsed)) {
        setConditions(parsed);
      } else if (parsed.op && parsed.items) {
        setConditions(parsed.items);
      } else {
        setConditions([parsed]);
      }
    } catch {
      setConditions([]);
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const body = {
        feature_id: feature.id,
        env_id: envId,
        name: values.name || '',
        priority: values.priority ?? 0,
        active: values.active ?? true,
        conditions: JSON.stringify(conditions.length > 0 ? conditions : []),
        enabled: values.enabled ?? false,
        value: values.value || '',
      };

      if (editingRule) {
        await updateRule(editingRule.id, body);
        message.success('规则已更新');
      } else {
        await createRule(body);
        message.success('规则已创建');
      }
      setModalOpen(false);
      onClose(); // 刷新上层
    } catch { /* validate */ }
  };

  const handleDelete = async (id) => {
    await deleteRule(id);
    message.success('规则已删除');
    onClose();
  };

  const columns = [
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 70,
      align: 'center',
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      ellipsis: true,
      render: (t) => t || <Text type="secondary">（未命名）</Text>,
    },
    {
      title: '状态',
      width: 70,
      align: 'center',
      render: (_, r) => r.active
        ? <Tag color="green">启用</Tag>
        : <Tag color="default">禁用</Tag>,
    },
    {
      title: '命中结果',
      width: 100,
      render: (_, r) => (
        <Space size={4}>
          {r.enabled
            ? <Tag color="orange">ON</Tag>
            : <Tag>OFF</Tag>}
          {r.value && <Tooltip title={r.value}><Text type="secondary" ellipsis style={{ maxWidth: 60 }}>= {r.value}</Text></Tooltip>}
        </Space>
      ),
    },
    {
      title: '条件',
      ellipsis: true,
      render: (_, r) => <ConditionSummary conditions={r.conditions} />,
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="确认删除此规则？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Drawer
        title={<span>定向规则 — <Text strong style={{ color: '#bf6c00' }}>{feature?.key_name}</Text></span>}
        placement="right"
        width={720}
        open={open}
        onClose={onClose}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建规则
          </Button>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rules}
          pagination={false}
          size="small"
          locale={{ emptyText: <Empty description="暂无规则" /> }}
        />
        <div style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
          规则按优先级从小到大求值，首条命中即终止。空条件（[]）表示 match all（基线规则）。
        </div>
      </Drawer>

      {/* 新建/编辑规则弹窗 */}
      <Modal
        title={editingRule ? '编辑规则' : '新建规则'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
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
    </>
  );
}

/* 条件摘要显示 */
function ConditionSummary({ conditions }) {
  try {
    const parsed = JSON.parse(conditions || '[]');
    const items = Array.isArray(parsed) ? parsed : (parsed.items || [parsed]);
    if (items.length === 0) return <Text type="secondary">match all</Text>;

    return (
      <Space size={4} wrap>
        {items.slice(0, 3).map((c, i) => {
          if (c.op) return <Tag key={i} color="blue">{c.op.toUpperCase()}(...)</Tag>;
          const label = c.type || '?';
          return <Tag key={i} color="geekblue">{label}</Tag>;
        })}
        {items.length > 3 && <Text type="secondary">+{items.length - 3}</Text>}
      </Space>
    );
  } catch {
    return <Text type="secondary">—</Text>;
  }
}

export default RuleDrawer;
