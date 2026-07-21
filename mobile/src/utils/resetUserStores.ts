import { useOrdersStore } from '../store/useOrdersStore';
import { useTicketsStore } from '../store/useTicketsStore';
import { useNotificationsStore } from '../store/useNotificationsStore';
import { useRewardsStore } from '../store/useRewardsStore';
import { useWalletStore } from '../store/useWalletStore';
import { useFinancialStore } from '../store/useFinancialStore';
import { useCanteenStore } from '../store/useCanteenStore';

/** Clear in-memory user data when switching accounts or signing out. */
export function resetAllUserStores(): void {
  useOrdersStore.getState().reset();
  useTicketsStore.getState().reset();
  useNotificationsStore.getState().reset();
  useRewardsStore.getState().reset();
  useWalletStore.getState().reset();
  useFinancialStore.getState().reset();
  useCanteenStore.getState().reset();
}
