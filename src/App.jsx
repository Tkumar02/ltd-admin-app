import MainLayout from "./layout/MainLayout";
import AuthForm from "./components/AuthForm";
import CompanySettings from "./pages/CompanySettings";
import { useState } from "react";

function App() {
  const [user, setUser] = useState(null);

  return (

    <MainLayout>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p>Your ltd company overview will appear here.</p>
      <>
        {!user ? (
          <AuthForm onUserChange={setUser} />
        ) : (
          <CompanySettings user={user} />
        )}
      </>
    </MainLayout>
  );
}

export default App;

