import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginChooserPage } from './pages/auth/LoginChooserPage'
import { RegisterChooserPage } from './pages/auth/RegisterChooserPage'
import { ParticipantLoginPage } from './pages/auth/ParticipantLoginPage'
import { FacilitatorLoginPage } from './pages/auth/FacilitatorLoginPage'
import { ParticipantRegisterPage } from './pages/auth/ParticipantRegisterPage'
import { FacilitatorRegisterPage } from './pages/auth/FacilitatorRegisterPage'
import { WorkshopListPage } from './pages/WorkshopListPage'
import { WorkshopDetailPage } from './pages/WorkshopDetailPage'
import { ReservationFormPage } from './pages/ReservationFormPage'
import { FacilitatorProfilePage } from './pages/FacilitatorProfilePage'
import { MyReservationsPage } from './pages/MyReservationsPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ManageWorkshopsPage } from './pages/manage/ManageWorkshopsPage'
import { WorkshopFormPage } from './pages/manage/WorkshopFormPage'
import { WorkshopReservationsPage } from './pages/manage/WorkshopReservationsPage'
import { ProfileEditPage } from './pages/manage/ProfileEditPage'
import { NotFoundPage } from './pages/NotFoundPage'

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

        <Route element={<ProtectedRoute loginPath="/login/participant" />}>
          <Route path="workshops/:id/reserve" element={<ReservationFormPage />} />
          <Route path="reservations" element={<MyReservationsPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/profile" element={<ProfileEditPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['admin', 'facilitator']} loginPath="/login/facilitator" />}>
          <Route path="manage" element={<ManageWorkshopsPage />} />
          <Route path="manage/workshops/new" element={<WorkshopFormPage />} />
          <Route path="manage/workshops/:id/edit" element={<WorkshopFormPage />} />
          <Route path="manage/workshops/:id/reservations" element={<WorkshopReservationsPage />} />
        </Route>

        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  )
}
