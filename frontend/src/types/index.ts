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

export interface FacilitatorProfile {
  id: number
  name: string
  bio: string
  role: UserRole
  avatar_url: string
}

export type WorkshopStatus = 'draft' | 'published' | 'canceled'

export type LocationType = 'online' | 'offline'

/** 閲覧者(ログインユーザー)によって値が変わる項目 */
export interface WorkshopViewer {
  is_favorited: boolean
  is_reserved: boolean
  // 主催者に参加をキャンセルされた。この場合は同じワークショップを再予約できない
  is_reservation_canceled: boolean
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
  cancellation_policy: string
  reserved_count: number
  status: WorkshopStatus
  viewer: WorkshopViewer
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
  | 'cancellation_policy'
  | 'status'
>

export type ReservationStatus = 'confirmed' | 'canceled'

export interface Reservation {
  id: number
  workshop_id: number
  workshop: Workshop
  user_id: number
  user_name: string
  attendee_name: string
  contact: string
  ticket_count: number
  status: ReservationStatus
  created_at: string
}

export interface ReservationCreate {
  attendee_name: string
  contact: string
  ticket_count: number
}

export type NotificationType = 'cancellation' | 'reminder' | 'reservation_canceled'

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
