export type UserRole = 'admin' | 'facilitator' | 'participant'

export type SelfRegisterRole = 'facilitator' | 'participant'

export interface User {
  id: number
  email: string
  name: string
  role: UserRole
  bio: string
  // 主催者アイコンの URL。未設定なら空文字
  avatar_url: string
}

// 一覧 API の1ページ分と、条件に一致する総件数
export interface Page<T> {
  items: T[]
  total: number
}

// 閲覧者(ログイン中のユーザー)によって値が変わる項目
export interface FacilitatorViewer {
  is_following: boolean
}

export interface FacilitatorProfile {
  id: number
  name: string
  bio: string
  role: UserRole
  avatar_url: string
  // 未ログインのとき、またはフォローの対象でない(運営の)ページでは null
  viewer: FacilitatorViewer | null
}

export type WorkshopStatus = 'draft' | 'published' | 'canceled'

export type LocationType = 'online' | 'offline'

// 参加費の支払方法。onsite: 当日会場で主催者へ / online: 予約時に Stripe でカード決済
export type PaymentMethod = 'onsite' | 'online'

/** 閲覧者(ログインユーザー)によって値が変わる項目 */
export interface WorkshopViewer {
  is_favorited: boolean
  is_reserved: boolean
  // 主催者に参加をキャンセルされた。この場合は同じワークショップを再予約できない
  is_reservation_canceled: boolean
  // オンライン決済の途中(支払い待ちで席を確保している期限内)。予約フォームから支払いを再開できる
  is_payment_pending: boolean
}

/** 予約した参加者と主催者にだけ返される、参加者向けの案内 */
export interface ParticipantInfo {
  // 当日の詳しい案内(集合場所・持ち物・参加 URL など)
  guide: string
  emergency_contact: string
}

export interface Workshop {
  id: number
  title: string
  description: string
  image_url: string
  facilitator_id: number
  facilitator_name: string
  facilitator_avatar_url: string
  location_type: LocationType
  location: string
  start_at: string
  end_at: string
  capacity: number
  price: number
  payment_method: PaymentMethod
  reserved_count: number
  status: WorkshopStatus
  viewer: WorkshopViewer
  // 閲覧者が予約済みの参加者・主催者・運営でなければ null
  participant_info: ParticipantInfo | null
}

/** ワークショップ詳細ページに出す関連ワークショップ。どれも開催予定のもの */
export interface RelatedWorkshops {
  same_facilitator: Workshop[]
  similar: Workshop[]
  // オフライン開催: 会場が近いもの / オンライン開催: 他のオンライン開催のもの
  nearby: Workshop[]
}

export type WorkshopInput = Pick<
  Workshop,
  | 'title'
  | 'description'
  | 'location_type'
  | 'location'
  | 'start_at'
  | 'end_at'
  | 'capacity'
  | 'price'
  | 'payment_method'
  | 'status'
> & {
  participant_guide: string
  emergency_contact: string
}

// pending_payment: オンライン決済の支払い待ち / expired: 支払われないまま期限が過ぎた(一覧には出ない)
export type ReservationStatus = 'confirmed' | 'canceled' | 'pending_payment' | 'expired'

// オンライン決済の支払いの状態
export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'refund_pending' | 'refunded' | 'refund_failed'

// 予約の最新の支払い(オンライン決済のときだけ)
export interface PaymentSummary {
  status: PaymentStatus
  amount: number
  // 本サービスの手数料と主催者の受取額(参加費の90%)。主催者・運営にだけ返る(参加者には null)
  platform_fee_amount: number | null
  facilitator_amount: number | null
  // Stripe の決済手数料(本サービスが負担する)。支払いが済むまでと、参加者には null
  stripe_fee_amount: number | null
  // 返金額。返金が決まるまでは null
  refund_amount: number | null
}

// 主催者が予約を取り消した理由。participant: 参加者からの申し出 / facilitator: 主催者の都合(中止を含む)
export type CancelReason = 'participant' | 'facilitator'

// 開催当日に主催者が記録する出欠
export type AttendanceStatus = 'unconfirmed' | 'present' | 'absent'

export interface Reservation {
  id: number
  workshop_id: number
  workshop: Workshop
  user_id: number
  user_name: string
  contact: string
  ticket_count: number
  status: ReservationStatus
  attendance: AttendanceStatus
  // 主催者が取り消したときの理由。取り消されていなければ null
  cancel_reason: CancelReason | null
  // 支払い待ちの席を確保している期限。支払い待ちでなければ null
  payment_expires_at: string | null
  // オンライン決済でなければ null
  payment: PaymentSummary | null
  created_at: string
}

export interface ReservationCreateResult {
  reservation: Reservation
  // オンライン決済のとき、移動する Stripe の支払い画面の URL。当日払いなら null(この時点で予約が確定)
  checkout_url: string | null
}

export interface ReservationCreate {
  contact: string
  ticket_count: number
}

export type NotificationType = 'cancellation' | 'reminder' | 'reservation_canceled' | 'new_workshop' | 'payment_refunded' | 'payment_refund_failed'

export interface Notification {
  id: number
  workshop_id: number
  workshop_title: string
  type: NotificationType
  message: string
  is_read: boolean
  created_at: string
}

export interface InquiryMessage {
  id: number
  sender_id: number
  sender_name: string
  // 閲覧しているユーザー自身が送ったメッセージか
  is_mine: boolean
  body: string
  // 主催者が参加者全員に一斉送信したお知らせか
  is_broadcast: boolean
  created_at: string
}

export interface InquirySummary {
  id: number
  workshop_id: number
  workshop_title: string
  // 閲覧しているユーザーが、その問い合わせのどちら側か
  my_role: 'participant' | 'facilitator'
  // やり取りの相手(参加者から見れば主催者、主催者から見れば参加者)
  counterpart_id: number
  counterpart_name: string
  counterpart_avatar_url: string
  last_message: string
  last_message_at: string
  unread_count: number
}

export interface InquiryDetail extends InquirySummary {
  messages: InquiryMessage[]
}

// 主催者の振込先口座。ordinary: 普通預金 / checking: 当座預金
export type BankAccountType = 'ordinary' | 'checking'

export interface BankAccount {
  bank_name: string
  bank_code: string
  branch_name: string
  branch_code: string
  account_type: BankAccountType
  account_number: string
  // 口座名義(カナ)
  account_holder: string
}

// 主催者の売上と振込の状況(円)
export interface PayoutSummary {
  // 振込を申請できる額(開催を終えた分の受取額 − 申請中・振込済みの額)
  available_amount: number
  // 開催前で、まだ申請できない受取額
  upcoming_amount: number
  requested_amount: number
  paid_amount: number
  min_amount: number
  transfer_fee: number
  can_request: boolean
  // 運営側でオンライン決済を使える設定になっているか
  online_payment_available: boolean
}

// 収入の明細(オンライン決済の支払い1件)
export interface Earning {
  payment_id: number
  workshop_id: number
  workshop_title: string
  workshop_end_at: string
  user_name: string
  status: PaymentStatus
  amount: number
  // 主催者の受取額。返金になった支払いは 0
  facilitator_amount: number
  // 開催を終えて、振込を申請できる額に入っているか
  settled: boolean
  paid_at: string | null
}

export type PayoutRequestStatus = 'requested' | 'paid' | 'rejected'

export interface PayoutRequest {
  id: number
  amount: number
  transfer_fee: number
  transfer_amount: number
  status: PayoutRequestStatus
  // 運営のメモ(振込日・却下の理由など)
  note: string
  requested_at: string
  processed_at: string | null
  // 申請時の振込先
  bank_account: BankAccount
}

export interface AdminPayoutRequest extends PayoutRequest {
  facilitator_id: number
  facilitator_name: string
  facilitator_email: string
}
