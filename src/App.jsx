import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ListsProvider } from './context/ListsContext.jsx';
import BottomNav from './components/BottomNav.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Search from './pages/Search.jsx';
import MyList from './pages/MyList.jsx';
import Profile from './pages/Profile.jsx';

function ProtectedLayout({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return null;
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="app-shell">
      <main className="app-content">{children}</main>
      <BottomNav />
    </div>
  );
}

function AppRoutes() {
  const { user, ready } = useAuth();
  if (!ready) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route
        path="/"
        element={
          <ProtectedLayout>
            <Search />
          </ProtectedLayout>
        }
      />
      <Route
        path="/want-to-watch"
        element={
          <ProtectedLayout>
            <MyList status="want_to_watch" />
          </ProtectedLayout>
        }
      />
      <Route
        path="/watched"
        element={
          <ProtectedLayout>
            <MyList status="watched" />
          </ProtectedLayout>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedLayout>
            <Profile />
          </ProtectedLayout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ListsProvider>
        <AppRoutes />
      </ListsProvider>
    </AuthProvider>
  );
}
