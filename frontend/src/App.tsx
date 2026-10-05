import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { LoginChooserPage } from '@/pages/auth/LoginChooserPage'
import { RegisterChooserPage } from '@/pages/auth/RegisterChooserPage'
import { ParticipantLoginPage } from '@/pages/auth/ParticipantLoginPage'
import { FacilitatorLoginPage } from '@/pages/auth/FacilitatorLoginPage'
import { ParticipantRegisterPage } from '@/pages/auth/ParticipantRegisterPage'
import { FacilitatorRegisterPage } from '@/pages/auth/FacilitatorRegisterPage'
import { WorkshopListPage } from '@/pages/workshops/WorkshopListPage'
import { WorkshopDetailPage } from '@/pages/workshops/WorkshopDetailPage'
import { ReservationFormPage } from '@/pages/reservations/ReservationFormPage'
import { FacilitatorProfilePage } from '@/pages/workshops/FacilitatorProfilePage'
import { MyReservationsPage, ReservationHistoryPage } from '@/pages/reservations/MyReservationsPage'
import { PaymentCompletePage } from '@/pages/reservations/PaymentCompletePage'
import { FavoritesPage } from '@/pages/me/FavoritesPage'
import { FollowingPage } from '@/pages/me/FollowingPage'
import { NotificationsPage } from '@/pages/me/NotificationsPage'
import { InquiriesPage } from '@/pages/inquiries/InquiriesPage'
import { InquiryThreadPage } from '@/pages/inquiries/InquiryThreadPage'
import { WorkshopInquiryPage } from '@/pages/inquiries/WorkshopInquiryPage'
import { MyPage } from '@/pages/me/MyPage'
import { ManageWorkshopsPage } from '@/pages/manage/ManageWorkshopsPage'
import { WorkshopFormPage } from '@/pages/manage/WorkshopFormPage'
import { WorkshopReservationsPage } from '@/pages/manage/WorkshopReservationsPage'
import { ProfileEditPage } from '@/pages/manage/ProfileEditPage'
import { PayoutSettingsPage } from '@/pages/manage/PayoutSettingsPage'
import { PAYOUT_SETTINGS_PATH } from '@/utils/payment'
import { HelpPage } from '@/pages/help/HelpPage'
import { AboutPage } from '@/pages/guide/AboutPage'
import { DialogueRulesPage } from '@/pages/guide/DialogueRulesPage'
import { TermsPage } from '@/pages/help/TermsPage'
import { CancellationPolicyPage } from '@/pages/help/CancellationPolicyPage'
import { FacilitatorGuidelinesPage } from '@/pages/help/FacilitatorGuidelinesPage'
import { TokushohoPage } from '@/pages/help/TokushohoPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<WorkshopListPage />} />
        <Route path="workshops/:id" element={<WorkshopDetailPage />} />
        <Route path="facilitators/:id" element={<FacilitatorProfilePage />} />

        <Route path="login" element={<LoginChooserPage />} />
        <Route path="login/participant" element={<ParticipantLoginPage />} />
        <Route path="login/facilitator" element={<FacilitatorLoginPage />} />
        <Route path="register" element={<RegisterChooserPage />} />
        <Route path="register/participant" element={<ParticipantRegisterPage />} />
        <Route path="register/facilitator" element={<FacilitatorRegisterPage />} />

        {/* 規約は登録前にも読めるよう、ログインしていなくても表示する */}
        <Route path="about" element={<AboutPage />} />
        <Route path="rules" element={<DialogueRulesPage />} />
        <Route path="help" element={<HelpPage />} />
        <Route path="help/terms" element={<TermsPage />} />
        <Route path="help/cancellation-policy" element={<CancellationPolicyPage />} />
        <Route path="help/facilitator-guidelines" element={<FacilitatorGuidelinesPage />} />
        <Route path="help/tokushoho" element={<TokushohoPage />} />

        <Route element={<ProtectedRoute loginPath="/login/participant" />}>
          <Route path="workshops/:id/reserve" element={<ReservationFormPage />} />
          <Route path="reservations" element={<MyReservationsPage />} />
          <Route path="reservations/history" element={<ReservationHistoryPage />} />
          {/* Stripe の支払い画面から戻ってくる先。バックエンドの start_checkout の success_url と揃える */}
          <Route path="reservations/:id/payment/complete" element={<PaymentCompletePage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="following" element={<FollowingPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="workshops/:id/inquiry" element={<WorkshopInquiryPage />} />
          <Route path="inquiries" element={<InquiriesPage />} />
          <Route path="inquiries/:id" element={<InquiryThreadPage />} />
          <Route path="me" element={<MyPage />} />
          <Route path="me/profile" element={<ProfileEditPage />} />
          {/* 以前の「設定」ページの URL。ブックマークなどから来ても新しい URL に移す */}
          <Route path="settings" element={<Navigate to="/me" replace />} />
          <Route path="settings/profile" element={<Navigate to="/me/profile" replace />} />
        </Route>

        <Route element={<ProtectedRoute roles={['admin', 'facilitator']} loginPath="/login/facilitator" />}>
          <Route path="manage" element={<ManageWorkshopsPage />} />
          <Route path="manage/workshops/new" element={<WorkshopFormPage />} />
          <Route path="manage/workshops/:id/edit" element={<WorkshopFormPage />} />
          <Route path="manage/workshops/:id/reservations" element={<WorkshopReservationsPage />} />
          <Route path={PAYOUT_SETTINGS_PATH.slice(1)} element={<PayoutSettingsPage />} />
        </Route>

        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  )
}
