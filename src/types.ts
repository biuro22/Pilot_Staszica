export interface WebUser {
  id: string;
  name: string;
  plotNumber?: string;
  passcode: string;
  role: 'dzialkowiec' | 'gosc' | 'admin';
  status: 'active' | 'blocked';
  blockReason: string;
  createdAt: string;
  suplaAccessToken?: string;
  mustChangePin?: boolean;
}

export interface PinResetRequest {
  id: string;
  userId: string;
  name: string;
  plotNumber: string;
  contactDetails?: string;
  requestedAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: 'dzialkowiec' | 'gosc' | 'admin' | 'system';
  action: 'OPEN' | 'CLOSE' | 'BLOCK' | 'UNBLOCK' | 'BULK_ACTION' | 'PUSH_SENT' | 'LOGIN' | 'SYSTEM';
  details: string;
}

export interface GateStatus {
  state: 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING' | 'UNKNOWN';
  lastUpdated: string;
  suplaConnected: boolean;
  suplaServerUrl: string;
  channelId: string;
  sensorChannelId?: string;
  lastActionBy?: string;
  lastTriggeredTime?: number;
  lastTriggeredAction?: string;
  partyModeActive?: boolean;
  invertSensor?: boolean;
}

export interface AppConfig {
  suplaServerUrl: string;
  gateChannelId: string;
  sensorChannelId?: string;
  suplaAccessToken: string;
}

export interface LockSchedule {
  enabled: boolean;
  startDateTime: string;
  endDateTime: string;
  reason: string;
}

export interface PushSubscriptionInfo {
  id: string;
  userName: string;
  deviceInfo: string;
  subscribedAt: string;
}
