import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Select, Button, Table, Tag, Space, Typography, Row, Col,
  Collapse, Empty, message, Tooltip, Badge, Descriptions, Statistic,
} from 'antd';
import {
  SearchOutlined, ClearOutlined, PlusOutlined, DeleteOutlined,
  AppstoreOutlined, CloudServerOutlined, UserOutlined,
  CheckCircleOutlined, CloseCircleOutlined, FilterOutlined,
} from '@ant-design/icons';
import { getApps, getEnvs, evalFeatures } from '../api/feature';

const { Text, Title } = Typography;

function FeatureQuery() {
  const [apps, setApps] = useState([]);
  const [envs, setEnvs] = useState([]);
  const [selectedAppKey, setSelectedAppKey] = useState(undefined);
  const [selectedEnvKey, setSelectedEnvKey] = useState(undefined);
  const [form] = Form.useForm();

  // 自定义属性
  const [attrs, setAttrs] = useState([]);

  // 查询结果
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState(null);

  useEffect(() => {
    getApps().then(({ data }) => setApps(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedAppKey) {
      const app = apps.find(a => a.app_key === selectedAppKey);
      if (app) {
        getEnvs(app.id).then(({ data }) => { setEnvs(data || []); setSelectedEnvKey(undefined); }).catch(() => {});
      }
    } else {
      setEnvs([]); setSelectedEnvKey(undefined);
    }
  }, [selectedAppKey, apps]);

  const addAttr = () => setAttrs([...attrs, { key: '', value: '' }]);
  const removeAttr = (idx) => setAttrs(attrs.filter((_, i) => i !== idx));
  const updateAttr = (idx, field, val) => {
    const next = [...attrs];
    next[idx] = { ...next[idx], [field]: val };
    setAttrs(next);
  };

  const handleQuery = async () => {
    if (!selectedAppKey || !selectedEnvKey) {
      message.warning('请选择应用和环境');
      return;
    }
    const values = form.getFieldsValue();
    const params = {
      app_key: selectedAppKey,
      env_key: selectedEnvKey,
    };
    if (values.user_id) params.user_id = values.user_id;
    if (values.version) params.version = values.version;
    if (values.platform) params.platform = values.platform;
    // 自定义属性
    attrs.forEach(a => {
      if (a.key && a.value) params[`attr_${a.key}`] = a.value;
    });

    setLoading(true);
    setLastQuery({ ...params });
    try {
      const { data } = await evalFeatures(params);
      // data 是 map: { key_name: { enabled, value } }
      const list = Object.entries(data || {}).map(([key, val]) => ({
        key,
        enabled: val.enabled,
        value: val.value,
      }));
      setResults(list);
    } catch {
      message.error('查询失败');
      setResults(null);
    }
    setLoading(false);
  };

  const handleReset = () => {
    form.resetFields();
    setSelectedAppKey(undefined);
    setSelectedEnvKey(undefined);
    setAttrs([]);
    setResults(null);
    setLastQuery(null);
  };

  // 统计
  const totalCount = results ? results.length : 0;
  const enabledCount = results ? results.filter(r => r.enabled).length : 0;
  const disabledCount = totalCount - enabledCount;

  // 结果列表搜索
  const [searchKey, setSearchKey] = useState('');
  const filteredResults = results
    ? results.filter(r => r.key.toLowerCase().includes(searchKey.toLowerCase()))
    : null;

  const columns = [
    {
      title: 'Feature Key',
      dataIndex: 'key',
      sorter: (a, b) => a.key.localeCompare(b.key),
      render: (text) => <Text strong style={{ color: '#bf6c00' }}>{text}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      align: 'center',
      filters: [
        { text: '开启', value: true },
        { text: '关闭', value: false },
      ],
      onFilter: (v, record) => record.enabled === v,
      render: (v) => v
        ? <Tag icon={<CheckCircleOutlined />} color="success">开启</Tag>
        : <Tag icon={<CloseCircleOutlined />} color="default">关闭</Tag>,
    },
    {
      title: '返回值',
      dataIndex: 'value',
      render: (v) => {
        if (v === undefined || v === null || v === '') return <Text type="secondary">—</Text>;
        const str = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return str.length > 80
          ? <Tooltip title={<pre style={{ margin: 0, maxHeight: 300, overflow: 'auto' }}>{str}</pre>}><Text code ellipsis style={{ maxWidth: 260 }}>{str}</Text></Tooltip>
          : <Text code>{str}</Text>;
      },
    },
  ];

  return (
    <div>
      {/* 过滤器 */}
      <Card
        title={<span><FilterOutlined style={{ color: '#f5a623', marginRight: 8 }} />用户查询过滤器</span>}
        style={{ marginBottom: 16 }}
        styles={{ body: { paddingBottom: 8 } }}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="应用" required>
                <Select
                  value={selectedAppKey}
                  placeholder="选择应用"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={apps.map(a => ({ value: a.app_key, label: `${a.name || a.app_key}  (${a.app_key})` }))}
                  onChange={setSelectedAppKey}
                  suffixIcon={<AppstoreOutlined />}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="环境" required>
                <Select
                  value={selectedEnvKey}
                  placeholder="选择环境"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={envs.map(e => ({ value: e.env_key, label: `${e.name || e.env_key}  (${e.env_key})` }))}
                  onChange={setSelectedEnvKey}
                  suffixIcon={<CloudServerOutlined />}
                  disabled={!selectedAppKey}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="user_id" label="User ID">
                <Input placeholder="模拟用户 ID" prefix={<UserOutlined />} allowClear />
              </Form.Item>
            </Col>
          </Row>

          <Collapse
            ghost
            items={[{
              key: 'advanced',
              label: <Text type="secondary" style={{ fontSize: 13 }}>高级过滤（version / platform / 自定义属性）</Text>,
              children: (
                <>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="version" label="Version">
                        <Input placeholder="如 2.1.0" allowClear />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="platform" label="Platform">
                        <Input placeholder="如 ios / android / web" allowClear />
                      </Form.Item>
                    </Col>
                  </Row>

                  <div style={{ marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>自定义属性 (attr_*)</Text>
                    <Button type="link" size="small" icon={<PlusOutlined />} onClick={addAttr}>添加</Button>
                  </div>
                  {attrs.map((attr, idx) => (
                    <Row gutter={8} key={idx} style={{ marginBottom: 8 }}>
                      <Col span={8}>
                        <Input
                          placeholder="属性名 (如 region)"
                          value={attr.key}
                          onChange={(e) => updateAttr(idx, 'key', e.target.value)}
                        />
                      </Col>
                      <Col span={8}>
                        <Input
                          placeholder="属性值 (如 cn)"
                          value={attr.value}
                          onChange={(e) => updateAttr(idx, 'value', e.target.value)}
                        />
                      </Col>
                      <Col span={4}>
                        <Button danger icon={<DeleteOutlined />} onClick={() => removeAttr(idx)} />
                      </Col>
                    </Row>
                  ))}
                </>
              ),
            }]}
          />

          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <Space>
              <Button icon={<ClearOutlined />} onClick={handleReset}>重置</Button>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleQuery}
                loading={loading}
                disabled={!selectedAppKey || !selectedEnvKey}
              >
                查询
              </Button>
            </Space>
          </div>
        </Form>
      </Card>

      {/* 查询参数摘要 */}
      {lastQuery && (
        <Card size="small" style={{ marginBottom: 16, background: '#fffbe6', border: '1px solid #ffe58f' }}>
          <Descriptions size="small" column={4}>
            <Descriptions.Item label="app_key">{lastQuery.app_key}</Descriptions.Item>
            <Descriptions.Item label="env_key">{lastQuery.env_key}</Descriptions.Item>
            {lastQuery.user_id && <Descriptions.Item label="user_id">{lastQuery.user_id}</Descriptions.Item>}
            {lastQuery.version && <Descriptions.Item label="version">{lastQuery.version}</Descriptions.Item>}
            {lastQuery.platform && <Descriptions.Item label="platform">{lastQuery.platform}</Descriptions.Item>}
            {Object.entries(lastQuery).filter(([k]) => k.startsWith('attr_')).map(([k, v]) => (
              <Descriptions.Item key={k} label={k}>{v}</Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      )}

      {/* 统计 + 结果 */}
      {results !== null && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card size="small" style={{ borderLeft: '3px solid #f5a623' }}>
                <Statistic title="Feature 总数" value={totalCount} valueStyle={{ color: '#f5a623' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ borderLeft: '3px solid #52c41a' }}>
                <Statistic title="开启" value={enabledCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ borderLeft: '3px solid #ccc' }}>
                <Statistic title="关闭" value={disabledCount} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#999' }} />
              </Card>
            </Col>
          </Row>

          <Card
            title={<span><SearchOutlined style={{ color: '#f5a623', marginRight: 8 }} />查询结果</span>}
            extra={
              <Input
                placeholder="搜索 Feature Key"
                prefix={<SearchOutlined />}
                allowClear
                style={{ width: 220 }}
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
              />
            }
            variant="borderless"
            styles={{ body: { padding: 0 } }}
          >
            <Table
              rowKey="key"
              columns={columns}
              dataSource={filteredResults}
              pagination={filteredResults && filteredResults.length > 20 ? { pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 项` } : false}
              size="middle"
              locale={{ emptyText: <Empty description="无匹配 Feature" /> }}
            />
          </Card>
        </>
      )}

      {results === null && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>
          <SearchOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <div style={{ fontSize: 15 }}>选择应用和环境后点击查询，模拟客户端视角获取 Feature 开关状态</div>
        </div>
      )}
    </div>
  );
}

export default FeatureQuery;
