import { NavigatorScreenParams } from '@react-navigation/native';

export type RootTabParamList = {
  Home: undefined;
  Shop: undefined;
  Transit: undefined;
  Parking: undefined;
  City: undefined;
  Wallet: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  MainTabs: NavigatorScreenParams<RootTabParamList>;
  Notifications: undefined;
  Settings: undefined;
  Rewards: undefined;
  VehicleInfo: { plate?: string } | undefined;
  OrderHistory: undefined;
  OrderReceipt: { orderId: string };
  Tickets: undefined;
  TicketDetail: { ticketId: string };
  ReceiptDetail: { receiptId: string };
  Account: undefined;
  AccountDetails: undefined;
  Bills: undefined;
  Invest: undefined;
  Loans: undefined;
  Insurance: undefined;
  Admin: undefined;
  Canteen: undefined;
};
