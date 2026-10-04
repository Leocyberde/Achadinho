export interface CustomerLoyaltySummary {
  freeDeliveryTickets: number;
  earnedAutoTickets: number;
  manualFreeDeliveryTickets: number;
  usedFreeDeliveryTickets: number;
  qualifyingOrdersCount: number;
  ordersInCurrentCycle: number;
  ordersRemainingForNextTicket: number;
  isFirstOrderEligible?: boolean;
  eligibleForFirstOrderFreeDelivery?: boolean;
  eligibleForFreeDelivery: boolean;
}

export interface UserProfile {
  id: number;
  name: string;
  cpf?: string | null;
  email: string;
  phone: string;
  role: 'ADMIN' | 'CUSTOMER';
  status?: string;
  freeDeliveryTickets?: number;
  manualFreeDeliveryTickets?: number;
  loyalty?: CustomerLoyaltySummary;
  eligibleForFirstOrderFreeDelivery?: boolean;
}

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  originalPrice?: number;
  promoPrice?: number | null;
  hasPromo?: boolean;
  promoMaxUnits?: number | null;
  imageUrl: string | null;
  categoryName?: string;
  stock: number;
  quantity: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

export interface CustomerNotification {
  id: number;
  userId: number;
  orderId: number | null;
  orderNumber: string;
  oldStatus: string | null;
  newStatus: string;
  title: string;
  message: string;
  isRead: boolean;
  popupDismissed: boolean;
  createdAt: string;
}

export interface ProductMediaItem {
  id?: number;
  imageUrl: string;
  mediaType?: 'IMAGE' | 'VIDEO' | string;
  durationSeconds?: number | null;
  isPrimary?: boolean;
}

export interface CepLookupResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement?: string;
}

// Status em português (Seção 12)
export const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: 'Novo',
  AWAITING_PAYMENT: 'Aguardando pagamento',
  PAID: 'Pago',
  PREPARING: 'Em preparo',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
  FIRST_ORDER_FREE_WELCOME: 'Entrega Grátis no 1° Pedido',
  FREE_DELIVERY_TICKET_EARNED: 'Ticket de Entrega Grátis',
  MANUAL_FREE_DELIVERY_GRANTED: 'Entrega Grátis Liberada',
};

export type PaymentMethodType = 'PIX' | 'CARD_CREDIT' | 'CARD_DEBIT' | 'CASH';

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PIX: 'Pix',
  CARD_CREDIT: 'Cartão de Crédito (na entrega)',
  CARD_DEBIT: 'Cartão de Débito (na entrega)',
  CASH: 'Dinheiro (na entrega)',
};

export const ORDER_STATUS_LIST = [
  { value: 'NEW', label: 'Novo' },
  { value: 'AWAITING_PAYMENT', label: 'Aguardando pagamento' },
  { value: 'PAID', label: 'Pago' },
  { value: 'PREPARING', label: 'Em preparo' },
  { value: 'OUT_FOR_DELIVERY', label: 'Saiu para entrega' },
  { value: 'DELIVERED', label: 'Entregue' },
  { value: 'CANCELLED', label: 'Cancelado' },
];
