// Hello World
/**
 * Tipos do banco (espelham supabase/migrations). Mantidos à mão porque o gerador oficial
 * exige Docker; se o schema mudar, atualize este arquivo junto com a migration.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "canceled"
  | "expired";
export type PaymentMethod = "pix" | "card";
export type PaymentStatus = "pending" | "paid" | "rejected" | "failed" | "expired" | "canceled" | "refunded";
export type ProductStatus = "draft" | "active" | "archived";
export type AffiliateStatus = "pending" | "info_requested" | "approved" | "rejected";
export type AffiliatePlatform = "instagram" | "tiktok" | "youtube" | "x" | "facebook" | "kwai" | "outra";
export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";
export type PixProvider = "stripe" | "manual";
export type Fulfillment = "stock" | "dimona";
export type DimonaShippingSpeed = "pac" | "sedex";
export type CustomRequestStatus = "new" | "quoted" | "approved" | "in_production" | "done" | "canceled";
export type CapModel = "trucker" | "dad_hat" | "snapback" | "aba_reta" | "bucket" | "nao_sei";
export type CapTechnique = "bordado" | "estampa" | "patch" | "nao_sei";
export type DesignMime = "image/png" | "image/jpeg" | "image/webp" | "application/pdf";
export type OrderEventType =
  | "created"
  | "pix_confirmed"
  | "pix_rejected"
  | "card_paid"
  | "card_failed"
  | "status_changed"
  | "expired"
  | "stock_conflict"
  | "note"
  | "payment_attempt_failed"
  | "dimona_sent"
  | "dimona_failed"
  | "dimona_status";

export type ShippingAddress = {
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  uf: string;
};

export type ProductSpec = {
  label: string;
  value: string;
};

type Timestamps = { created_at: string; updated_at: string };

export type ProfileRow = Timestamps & {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: "customer" | "admin";
};

export type CategoryRow = Timestamps & {
  id: string;
  name: string;
  slug: string;
  position: number;
  is_active: boolean;
};

export type ProductRow = Timestamps & {
  id: string;
  slug: string;
  name: string;
  description: string;
  specs: ProductSpec[];
  category_id: string | null;
  status: ProductStatus;
  is_featured: boolean;
  position: number;
  seo_title: string | null;
  seo_description: string | null;
  fulfillment: Fulfillment;
};

export type VariantRow = Timestamps & {
  id: string;
  product_id: string;
  sku: string | null;
  color: string | null;
  size: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  stock: number;
  is_active: boolean;
  position: number;
  dimona_sku_id: string | null;
};

/** Lados aceitos pela API v3 da Dimona para artes e mockups. */
export type DimonaSide = "front" | "back" | "left_sleeve" | "right_sleeve" | "inner_label" | "outer_label";
export type DimonaFiles = Partial<Record<DimonaSide, string>>;

export type ProductDimonaRow = {
  product_id: string;
  designs: DimonaFiles;
  mocks: DimonaFiles;
  updated_at: string;
};

export type ImageRow = {
  id: string;
  product_id: string;
  storage_path: string;
  alt: string;
  color: string | null;
  position: number;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type StoreSettingsRow = {
  id: boolean;
  store_name: string;
  contact_email: string | null;
  whatsapp: string | null;
  instagram_url: string | null;
  pix_key: string | null;
  pix_key_type: PixKeyType | null;
  pix_holder_name: string | null;
  pix_city: string | null;
  pix_expiration_hours: number;
  card_enabled: boolean;
  announcement: string | null;
  shipping_policy: string | null;
  exchange_policy: string | null;
  pix_provider: PixProvider;
  custom_enabled: boolean;
  custom_unit_price_cents: number | null;
  custom_min_quantity: number;
  custom_max_quantity: number;
  custom_step_units: number;
  custom_step_bps: number;
  custom_max_discount_bps: number;
  dimona_auto_forward: boolean;
  dimona_shipping_speed: DimonaShippingSpeed;
  /** Frete da UF somado ao preço de cada unidade (migração 20261022120000; ausente antes dela). */
  shipping_in_price?: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type ShippingRateRow = {
  uf: string;
  price_cents: number;
  delivery_estimate: string | null;
  is_active: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type AffiliateApplicationRow = Timestamps & {
  id: string;
  status: AffiliateStatus;
  full_name: string;
  cpf: string;
  phone: string;
  email: string;
  platform: AffiliatePlatform;
  profile_url: string;
  followers_declared: number;
  followers_verified: number | null;
  audience: string;
  sales_forecast_monthly: number;
  sales_forecast_basis: string;
  strategy: string;
  channels: string[];
  truth_confirmed: boolean;
  privacy_consent_at: string;
  status_token: string;
  info_request_message: string | null;
  applicant_response: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  ip_hash: string | null;
};

export type AffiliateAttemptRow = {
  id: number;
  cpf: string;
  phone: string;
  reason: "duplicate_pair";
  existing_application_id: string | null;
  ip_hash: string | null;
  created_at: string;
};

export type CouponRow = Timestamps & {
  id: string;
  code: string;
  description: string | null;
  kind: "percent" | "fixed";
  value: number;
  min_subtotal_cents: number;
  max_uses: number | null;
  max_uses_per_customer: number;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  uses_count: number;
  affiliate_application_id: string | null;
  created_by: string | null;
};

export type OrderRow = Timestamps & {
  id: string;
  number: number;
  public_token: string;
  idempotency_key: string;
  user_id: string | null;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: ShippingAddress;
  shipping_uf: string;
  shipping_cents: number;
  shipping_estimate: string | null;
  cep_verified: boolean;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  coupon_id: string | null;
  coupon_code: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  tracking_code: string | null;
  customer_notes: string | null;
  expires_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  canceled_at: string | null;
  customer_document: string | null;
  pix_provider: PixProvider | null;
  pix_qr_data: string | null;
  pix_qr_expires_at: string | null;
  dimona_order_id: string | null;
  dimona_status: string | null;
  dimona_status_id: number | null;
  dimona_tracking_url: string | null;
  dimona_sent_at: string | null;
  dimona_updated_at: string | null;
  dimona_last_error: string | null;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_label: string | null;
  sku: string | null;
  image_path: string | null;
  unit_price_cents: number;
  quantity: number;
  total_cents: number;
};

export type OrderEventRow = {
  id: number;
  order_id: string;
  type: OrderEventType;
  from_status: string | null;
  to_status: string | null;
  actor_kind: "system" | "admin" | "customer" | "stripe" | "dimona";
  actor_id: string | null;
  message: string | null;
  created_at: string;
};

export type CustomCapRequestRow = Timestamps & {
  id: string;
  number: number;
  status: CustomRequestStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  quantity: number;
  cap_model: CapModel;
  cap_color: string | null;
  technique: CapTechnique;
  notes: string | null;
  design_path: string;
  design_mime: DesignMime;
  design_size: number;
  unit_price_cents: number | null;
  discount_bps: number;
  estimated_total_cents: number | null;
  privacy_consent_at: string;
  ip_hash: string | null;
  admin_notes: string | null;
  updated_by: string | null;
};

type Table<Row, Required extends keyof Row = never, Rel extends Relationship[] = []> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: Rel;
};

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id" | "email">;
      categories: Table<CategoryRow, "name" | "slug">;
      products: Table<
        ProductRow,
        "slug" | "name",
        [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ]
      >;
      product_variants: Table<
        VariantRow,
        "product_id" | "price_cents",
        [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ]
      >;
      product_images: Table<
        ImageRow,
        "product_id" | "storage_path",
        [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ]
      >;
      product_dimona: Table<
        ProductDimonaRow,
        "product_id",
        [
          {
            foreignKeyName: "product_dimona_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ]
      >;
      custom_cap_requests: Table<CustomCapRequestRow>;
      store_settings: Table<StoreSettingsRow>;
      shipping_rates: Table<ShippingRateRow, "uf" | "price_cents">;
      affiliate_applications: Table<AffiliateApplicationRow>;
      affiliate_attempts: Table<
        AffiliateAttemptRow,
        never,
        [
          {
            foreignKeyName: "affiliate_attempts_existing_application_id_fkey";
            columns: ["existing_application_id"];
            isOneToOne: false;
            referencedRelation: "affiliate_applications";
            referencedColumns: ["id"];
          },
        ]
      >;
      coupons: Table<
        CouponRow,
        "code" | "kind" | "value",
        [
          {
            foreignKeyName: "coupons_affiliate_application_id_fkey";
            columns: ["affiliate_application_id"];
            isOneToOne: false;
            referencedRelation: "affiliate_applications";
            referencedColumns: ["id"];
          },
        ]
      >;
      orders: Table<
        OrderRow,
        never,
        [
          {
            foreignKeyName: "orders_coupon_id_fkey";
            columns: ["coupon_id"];
            isOneToOne: false;
            referencedRelation: "coupons";
            referencedColumns: ["id"];
          },
        ]
      >;
      order_items: Table<
        OrderItemRow,
        never,
        [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ]
      >;
      order_events: Table<
        OrderEventRow,
        never,
        [
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ]
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      quote_order: { Args: { p: Json }; Returns: Json };
      create_order: { Args: { p: Json; p_user_id?: string | null }; Returns: Json };
      expire_stale_orders: { Args: Record<string, never>; Returns: number };
      expire_order: { Args: { p_order_id: string }; Returns: boolean };
      attach_stripe_session: {
        Args: { p_order_id: string; p_session_id: string; p_session_expires_at: string };
        Returns: undefined;
      };
      process_stripe_event: {
        Args: {
          p_event_id: string;
          p_event_type: string;
          p_order_id: string;
          p_session_id: string | null;
          p_payment_intent_id: string | null;
          p_outcome: "paid" | "failed" | "expired";
        };
        Returns: string;
      };
      attach_payment_intent: {
        Args: {
          p_order_id: string;
          p_payment_intent_id: string;
          p_pix_qr_data?: string | null;
          p_pix_qr_expires_at?: string | null;
        };
        Returns: undefined;
      };
      process_payment_intent_event: {
        Args: {
          p_event_id: string;
          p_event_type: string;
          p_order_id: string;
          p_payment_intent_id: string;
          p_outcome: "paid" | "failed" | "canceled";
        };
        Returns: string;
      };
      dimona_mark_sent: { Args: { p_order_id: string; p_dimona_id: string | null; p_message?: string | null }; Returns: undefined };
      dimona_mark_failed: { Args: { p_order_id: string; p_error: string }; Returns: undefined };
      dimona_apply_status: {
        Args: {
          p_dimona_id: string | null;
          p_seller_id: string | null;
          p_status_id: number | null;
          p_status_name: string | null;
          p_tracking_url: string | null;
        };
        Returns: string;
      };
      submit_custom_request: { Args: { p: Json; p_ip_hash?: string | null }; Returns: Json };
      custom_discount_bps: {
        Args: { p_quantity: number; p_step_units: number; p_step_bps: number; p_max_bps: number };
        Returns: number;
      };
      get_order_by_token: { Args: { p_token: string }; Returns: Json };
      submit_affiliate_application: { Args: { p: Json; p_ip_hash?: string | null }; Returns: Json };
      get_affiliate_status: { Args: { p_token: string }; Returns: Json };
      affiliate_respond: { Args: { p_token: string; p_message: string }; Returns: Json };
      admin_confirm_pix: { Args: { p_order_id: string; p_note?: string | null }; Returns: Json };
      admin_reject_pix: { Args: { p_order_id: string; p_reason: string }; Returns: Json };
      admin_set_order_status: {
        Args: { p_order_id: string; p_status: string; p_tracking_code?: string | null; p_note?: string | null };
        Returns: Json;
      };
      admin_approve_affiliate: {
        Args: { p_id: string; p_followers_verified: number; p_notes?: string | null };
        Returns: Json;
      };
      admin_reject_affiliate: { Args: { p_id: string; p_notes: string }; Returns: Json };
      admin_request_affiliate_info: { Args: { p_id: string; p_message: string }; Returns: Json };
      admin_save_product: { Args: { p: Json }; Returns: Json };
      admin_delete_product: { Args: { p_id: string }; Returns: Json };
      admin_dashboard: { Args: { p_days?: number }; Returns: Json };
      hit_rate_limit: { Args: { p_key: string; p_limit: number; p_window_seconds: number }; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
