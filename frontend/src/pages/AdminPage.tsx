import { useEffect, useState, type ReactNode } from 'react';
import { FiShield, FiUsers } from 'react-icons/fi';
import { useLocation } from 'react-router-dom';
import Page from '../components/Page/Page';
import { type SidebarItem } from '../components/Sidebar/Sidebar';

interface AdminPageProps {
  children: ReactNode;
}

const sidebarItems: SidebarItem[] = [
  {
    name: 'Organizer Requests',
    value: 'requests',
    icon: FiShield,
    url: '/admin',
  },
  {
    name: 'Manage Users',
    value: 'users',
    icon: FiUsers,
    url: '/admin/users',
  },
];

const AdminPage = ({ children }: AdminPageProps): ReactNode => {
  const location = useLocation();

  const getSidebarValueFromPath = (): string => {
    const match = sidebarItems.find((item) => item.url === location.pathname);
    return (match ?? sidebarItems[0]).value;
  };

  const [sidebarValue, setSidebarValue] = useState<string>(
    getSidebarValueFromPath()
  );

  useEffect(() => {
    setSidebarValue(getSidebarValueFromPath());
  }, [location]);

  return (
    <Page
      sidebarItems={sidebarItems}
      sidebarValue={sidebarValue}
      setSidebarValue={setSidebarValue}
      sidebarBackTo={{ label: 'Home', url: '/' }}
    >
      <div className="h-full overflow-auto">{children}</div>
    </Page>
  );
};

export default AdminPage;
