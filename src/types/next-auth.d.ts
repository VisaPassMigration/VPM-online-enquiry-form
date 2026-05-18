import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      staffUserId: string;
      roles: string[];
      isActive: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    staffUserId?: string;
    authUserId?: string;
    roles?: string[];
    isActive?: boolean;
  }
}
