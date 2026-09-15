import { BrowserRouter, Routes, Route } from "react-router-dom"
import Services from "./pages/Services"
import HowItWorks from "./pages/HowItWorks"
import Checkout from "./pages/Checkout Page/Checkout"
import About from "./pages/About"
import AdminDashboard from "./pages/AdminDashboard/AdminDashboard"
import CleanerDashboard from "./pages/CleanerDashbaord/CleanerDashbaord"
import Login from "./pages/Login/Login"
import UserDashboard from "./pages/UserDashboard"
import PaymentSuccess from "./pages/PaymentSuccess"
import BecomeCleaner from "./pages/BecomeCleaner"
import CleanerProfile from "./pages/CleanerProfile"


const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Services />} />
        <Route path="/About" element={<About />} />
        <Route path="/HowItWorks" element={<HowItWorks />} />
        <Route path="/Checkout" element={<Checkout />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/cleaner" element={<CleanerDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/User" element={<UserDashboard />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/become-cleaner" element={<BecomeCleaner />} />
        <Route path="/cleaner-profile" element={<CleanerProfile />} />
       
      </Routes>
    </BrowserRouter>
  )
}

export default App