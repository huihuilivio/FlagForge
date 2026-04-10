import React, { useState, useEffect } from 'react';
import {
  Table, Card, Tag, Space, Typography, Empty, Select, Button, Tooltip,
  Row, Col, Statistic,
} from 'antd';
import {
  ReloadOutlined, AuditOutlined, FileTextOutlined,
  AppstoreOutlined, CloudServerOutlined, ExperimentOutlined, AimOutlined,
} from '@ant-design/icons';
import { getApps, getAuditLogs } from '../api/feature';

const { Text } = Typography;

const ACTION_COLORS = {
  create: 'green',
  update: 'blue',
  delete: 'red',
};

const ACTION_LABELS = {
  create: '创建',
  update: '更新',
  delete: '删除',
};

const TARGET_ICONS = {
  app: <AppstoreOutlined />,
  env: <CloudServerOutlined />,
  feature: <ExperimentOutlined />,
  rule: <AimOutlined />,
};

const TARGET_LABELS = {
  app: '应用',
  env: '环境',
  feature: '特性',
  rule: '规则',
};

function AuditLogPage() {
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterType, setFilterType] = useState(null);

  useEffect(() => {
    getApps().then(({ data }) => setApps(data || [])).catch(() => {});
  }, []);

  const load = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const params = { limit: ps, offset: (p - 1) * ps };
      if (selectedApp) params.app_id = selectedApp.id;
      if (filterType) params.target_type = filterType;
      const { data } = await getAuditLogs(params);
      setLogs(data.data || []);
      setTotal(data.total || 0);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => { setPage(1); load(1); }, [selectedApp, filterType]);
  useEffect(() => { load(); }, [page, pageSize]);

  // 统计
  const createCount = logs.filter(l => l.action === 'create').length;
  const updateCount = logs.filter(l => l.action === 'update').length;
  const deleteCount = logs.filter(l => l.action === 'delete').length;

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      align: 'center',
      render: (id) => <Text type="secondary">#{id}</Text>,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 180,
      render: (t) => t ? new Date(t).toLocaleString('zh-CN') : '—',
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 90,
      align: 'center',
      render: (a) => <Tag color={ACTION_COLORS[a] || 'default'}>{ACTION_LABELS[a] || a}</Tag>,
    },
    {
      title: '对象类型',
      dataIndex: 'target_type',
      width: 100,
      render: (t) => (
        <Space size={4}>
          {TARGET_ICONS[t] || <FileTextOutlined />}
          <span>{TARGET_LABELS[t] || t}</span>
        </Space>
      ),
    },
    {
      title: '对象 ID',
      dataIndex: 'target_id',
      width: 80,
      align: 'center',
      render: (id) => <Text code>#{id}</Text>,
    },
    {
      title: '操作者',
      dataIndex: 'operator',
      width: 100,
      ellipsis: true,
      render: (t) => t ? <Text ellipsis={{ tooltip: t }}>{t}</Text> : <Text type="secondary">system</Text>,
    },
    {
      title: '详情',
      dataIndex: 'detail',
      ellipsis: true,
      render: (detail) => {
        if (!detail) return <Text type="secondary">—</Text>;
        try {
          const obj = JSON.parse(detail);
          // 展示关键字段
          const keys = Object.keys(obj).filter(k => !['id', 'created_at', 'updated_at', 'targeting_rules', 'features', 'environments'].includes(k));
          const summary = keys.slice(0, 4).map(k => {
            const v = obj[k];
            const display = typeof v === 'object' ? JSON.stringify(v).substring(0, 30) : String(v).substring(0, 30);
            return `${k}: ${display}`;
          }).join(', ');
          return (
            <Tooltip title={<pre style={{ maxHeight: 300, overflow: 'auto', margin: 0, fontSize: 11 }}>{JSON.stringify(obj, null, 2)}</pre>}>
              <Text type="secondary" style={{ fontSize: 12 }}>{summary}{keys.length > 4 ? '...' : ''}</Text>
            </Tooltip>
          );
        } catch {
          return <Text type="secondary" style={{ fontSize: 12 }}>{detail.substring(0, 60)}</Text>;
        }
      },
    },
  ];

  return (
    <div>
      {/* 统计 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '3px solid #f5a623' }}>
            <Statistic title="本页记录" value={logs.length} suffix={`/ ${total}`} prefix={<AuditOutlined />} valueStyle={{ color: '#f5a623' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '3px solid #52c41a' }}>
            <Statistic title="创建" value={createCount} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '3px solid #1890ff' }}>
            <Statistic title="更新" value={updateCount} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '3px solid #ff4d4f' }}>
            <Statistic title="删除" value={deleteCount} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <AuditOutlined style={{ color: '#f5a623' }} />
            <span>操作审计</span>
            <Select
              style={{ width: 160 }}
              value={selectedApp?.id}
              placeholder="全部应用"
              allowClear
              options={apps.map(a => ({ value: a.id, label: a.name || a.app_key }))}
              onChange={(id) => setSelectedApp(id ? apps.find(a => a.id === id) : null)}
              suffixIcon={<AppstoreOutlined />}
            />
          </Space>
        }
        extra={
          <Space>
            <Select
              style={{ width: 120 }}
              placeholder="对象类型"
              allowClear
              value={filterType}
              onChange={(v) => setFilterType(v || null)}
              options={[
                { value: 'app', label: '应用' },
                { value: 'env', label: '环境' },
                { value: 'feature', label: '特性' },
                { value: 'rule', label: '规则' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => load()}>刷新</Button>
          </Space>
        }
        variant="borderless"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={loading}
          tableLayout="fixed"
          scroll={{ x: 800 }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          size="middle"
          locale={{ emptyText: <Empty description="暂无审计记录" /> }}
        />
      </Card>

      <div style={{ marginTop: 16, padding: '12px 16px', background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          💡 所有管理操作（创建/更新/删除 应用、环境、特性、规则）都会自动记录审计日志。
        </Text>
      </div>
    </div>
  );
}

export default AuditLogPage;
