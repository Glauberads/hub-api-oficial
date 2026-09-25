import { useEffect } from 'react';

const useSocketListener = (socket, user, eventName, callback, dependencies = []) => {
  useEffect(() => {
    if (user?.companyId && socket && typeof socket.on === 'function') {
      const fullEventName = `company-${user.companyId}-${eventName}`;
      
      socket.on(fullEventName, callback);

      return () => {
        if (socket && typeof socket.off === 'function') {
          socket.off(fullEventName, callback);
        }
      };
    }
  }, [socket, user?.companyId, ...dependencies]);
};

export default useSocketListener;