import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ConfigProvider, Layout, Menu, theme } from 'antd';
import {
  AppstoreOutlined,
  CloudServerOutlined,
  ExperimentOutlined,
  AimOutlined,
  AuditOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { getApps, getEnvs } from './api/feature';
import AppManage from './pages/AppManage';
import EnvManage from './pages/EnvManage';
import FeatureList from './pages/FeatureList';
import RuleManage from './pages/RuleManage';
import AuditLogPage from './pages/AuditLog';
import FeatureQuery from './pages/FeatureQuery';

const { Header, Sider, Content } = Layout;

/* ============ 浅橙黄主题 ============ */
const themeConfig = {
  token: {
    colorPrimary: '#f5a623',
    colorLink: '#e8920d',
    colorBgContainer: '#fffdf8',
    borderRadius: 8,
    colorBgLayout: '#fef9f0',
  },
  algorithm: theme.defaultAlgorithm,
};

/* ============ Context：App + Env 全局状态 ============ */
export const AppContext = React.createContext(null);

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [apps, setApps] = useState([]);
  const [currentApp, setCurrentApp] = useState(null);
  const [envs, setEnvs] = useState([]);
  const [currentEnv, setCurrentEnv] = useState(null);

  const loadApps = async () => {
    try {
      const { data } = await getApps();
      setApps(data || []);
    } catch { /* ignore */ }
  };

  const loadEnvs = async (appId) => {
    if (!appId) return;
    try {
      const { data } = await getEnvs(appId);
      setEnvs(data || []);
      setCurrentEnv(null);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadApps(); }, []);
  useEffect(() => { if (currentApp) loadEnvs(currentApp.id); }, [currentApp]);

  const menuItems = [
    { key: '/apps', icon: <AppstoreOutlined />, label: '应用管理' },
    { key: '/envs', icon: <CloudServerOutlined />, label: '环境管理' },
    { key: '/features', icon: <ExperimentOutlined />, label: '特性管理' },
    { key: '/rules', icon: <AimOutlined />, label: '规则管理' },
    { key: '/query', icon: <SearchOutlined />, label: '特性查询' },
    { key: '/audit', icon: <AuditOutlined />, label: '操作审计' },
  ];

  // 默认匹配菜单
  const allKeys = ['/', '/apps', '/envs', '/features', '/rules', '/query', '/audit'];
  const selectedKey = allKeys.includes(location.pathname)
    ? (location.pathname === '/' ? '/apps' : location.pathname)
    : '/apps';

  return (
    <AppContext.Provider value={{ currentApp, currentEnv, envs, apps, loadApps, loadEnvs, setCurrentApp, setCurrentEnv }}>
      <Layout style={{ minHeight: '100vh' }}>
        {/* 侧边栏 */}
        <Sider width={240} style={{ background: '#fff8ee', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 16px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#e8920d', marginBottom: 4 }}>
              🚩 FlagForge
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>Feature Flag Admin</div>
          </div>

          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ background: 'transparent', borderRight: 'none', fontWeight: 500 }}
          />
        </Sider>

        <Layout>
          <Header style={{
            background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 48,
            lineHeight: '48px',
          }}>
            <span style={{ fontWeight: 600, color: '#bf6c00' }}>FlagForge</span>
          </Header>

          <Content style={{ margin: 16, padding: 20, background: '#fff', borderRadius: 8, overflow: 'auto' }}>
            <Routes>
              <Route path="/" element={<AppManage />} />
              <Route path="/apps" element={<AppManage />} />
              <Route path="/envs" element={<EnvManage />} />
              <Route path="/features" element={<FeatureList />} />
              <Route path="/rules" element={<RuleManage />} />
              <Route path="/query" element={<FeatureQuery />} />
              <Route path="/audit" element={<AuditLogPage />} />
              <Route path="*" element={<AppManage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </AppContext.Provider>
  );
}

function App() {
  return (
    <ConfigProvider theme={themeConfig}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppLayout />
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
