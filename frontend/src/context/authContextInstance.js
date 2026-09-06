import { createContext } from "react";

/**
 * Isolated AuthContext definition instance to satisfy Vite React Fast Refresh
 * and eliminate full React tree remounts during HMR.
 */
export const AuthContext = createContext(null);
