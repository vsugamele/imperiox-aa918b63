import { Navigate } from "react-router-dom";
import { CINNA_NATIVE_FLOW_URL } from "@/lib/cinna-shield-x1/openflow";

export default function CinnaShieldNative() {
  return <Navigate to={CINNA_NATIVE_FLOW_URL} replace />;
}
