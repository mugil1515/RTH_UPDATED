import { Route, Routes } from "react-router-dom";
import PageLayout from "@/components/layout/PageLayout";
import Home from "@/pages/Home";
import ServicesPage from "@/pages/Services";
import ServiceDetails from "@/pages/ServiceDetails";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/NotFound";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PageLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:slug" element={<ServiceDetails />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
