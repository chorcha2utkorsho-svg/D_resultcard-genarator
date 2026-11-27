import React from 'react';
import { PortalAuthSession } from '../types';
import { CategoryStaffDashboardView } from './CategoryStaffDashboardView';

interface EmployeeDashboardViewProps {
  session: PortalAuthSession;
  onNavigate: (tab: string) => void;
}

export const EmployeeDashboardView: React.FC<EmployeeDashboardViewProps> = ({
  session,
  onNavigate,
}) => {
  return <CategoryStaffDashboardView session={session} onNavigate={onNavigate} />;
};
