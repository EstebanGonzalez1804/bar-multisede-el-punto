import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { CambiarPasswordPage } from "./pages/CambiarPasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { MesasPage } from "./pages/MesasPage";
import { ProductosPage } from "./pages/ProductosPage";
import { SedesPage } from "./pages/SedesPage";
import { TiposProductoPage } from "./pages/TiposProductoPage";
import { UsuariosPage } from "./pages/UsuariosPage";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="cambiar-password" element={<CambiarPasswordPage />} />
          <Route
            path="sedes"
            element={
              <ProtectedRoute perfilesPermitidos={["ADMINISTRADOR"]}>
                <SedesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="usuarios"
            element={
              <ProtectedRoute perfilesPermitidos={["ADMINISTRADOR"]}>
                <UsuariosPage />
              </ProtectedRoute>
            }
          />
          {/* HU-011/HU-013/HU-017: el catálogo y las mesas los puede consultar
              cualquier perfil autenticado; cada página oculta las acciones de
              creación/edición cuando el usuario no es Administrador. */}
          <Route path="mesas" element={<MesasPage />} />
          <Route path="tipos-producto" element={<TiposProductoPage />} />
          <Route path="productos" element={<ProductosPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
