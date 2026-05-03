import { useEffect, useRef, useState } from 'react';

export function useSocket(userId) {
  const [connected,     setConnected]     = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [liveJobs,      setLiveJobs]      = useState([]);
  const handlers = useRef({});

  useEffect(() => {
    if (!userId) return;

    function attach() {
      const socket = window._japSocket;
      if (!socket) return false;

      handlers.current = {
        onConnect:      () => setConnected(true),
        onDisconnect:   () => setConnected(false),
        onNotification: (n)          => setNotifications(p => [n, ...p].slice(0, 50)),
        onJobsNew:      ({ jobs = [] }) => setLiveJobs(p => {
          const ids = new Set(p.map(j => j.id));
          return [...jobs.filter(j => !ids.has(j.id)), ...p].slice(0, 200);
        }),
      };

      socket.on('connect',      handlers.current.onConnect);
      socket.on('disconnect',   handlers.current.onDisconnect);
      socket.on('notification', handlers.current.onNotification);
      socket.on('jobs:new',     handlers.current.onJobsNew);
      if (socket.connected) setConnected(true);
      return true;
    }

    if (!attach()) {
      const t = setInterval(() => { if (attach()) clearInterval(t); }, 300);
      return () => clearInterval(t);
    }

    return () => {
      const s = window._japSocket;
      const h = handlers.current;
      if (s && h.onConnect) {
        s.off('connect',      h.onConnect);
        s.off('disconnect',   h.onDisconnect);
        s.off('notification', h.onNotification);
        s.off('jobs:new',     h.onJobsNew);
      }
    };
  }, [userId]);

  return {
    connected,
    notifications,
    liveJobs,
    clearNotification: (i) => setNotifications(p => p.filter((_, idx) => idx !== i)),
  };
}
