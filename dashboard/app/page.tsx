'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

interface Appointment {
  id: string;
  patientPhone: string;
  chatId: string;
  patientName: string;
  age: string;
  gender: string;
  address: string;
  service: string;
  day: string;
  time: string;
  status: 'confirmed' | 'cancelled';
  bookedAt: string;
}

interface Stats {
  total: number;
  confirmed: number;
  cancelled: number;
  byService: Record<string, number>;
}

type View = 'dashboard' | 'calendar' | 'patients';

const API_BASE = 'http://localhost:3000';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Maps day-of-week names to JS day indices for the current/next occurrence
const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

function getInitials(name: string): string {
  if (!name || name === 'Unknown' || name === 'N/A') return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getDateForDay(dayName: string, refDate: Date): number | null {
  const input = dayName.toLowerCase().trim();
  const calMonth = refDate.getMonth();
  const calYear = refDate.getFullYear();

  // 1. Try weekday name (Monday, Tuesday, etc.)
  const targetDay = DAY_MAP[input];
  if (targetDay !== undefined) {
    // Find ALL occurrences of this weekday in the calendar month
    const dates: number[] = [];
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(calYear, calMonth, d).getDay() === targetDay) {
        dates.push(d);
      }
    }
    // Return the next upcoming one (or the first one this month)
    const today = new Date().getDate();
    const upcoming = dates.find(d => d >= today);
    return upcoming || dates[0] || null;
  }

  // 2. Try specific date like "May 25th", "May 25", "25th", "25"
  // Match "Month Day" pattern
  const monthDayMatch = input.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})/);
  if (monthDayMatch) {
    const monthStr = monthDayMatch[1];
    const dayNum = parseInt(monthDayMatch[2]);
    const monthIdx = MONTH_NAMES.findIndex(m => m.toLowerCase().startsWith(monthStr));
    if (monthIdx === calMonth && dayNum >= 1 && dayNum <= 31) {
      return dayNum;
    }
    return null;
  }

  // Match just a number like "25th" or "25"
  const numMatch = input.match(/^(\d{1,2})(st|nd|rd|th)?$/);
  if (numMatch) {
    const dayNum = parseInt(numMatch[1]);
    if (dayNum >= 1 && dayNum <= 31) return dayNum;
  }

  return null;
}

export default function Dashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, confirmed: 0, cancelled: 0, byService: {} });
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [calendarDate, setCalendarDate] = useState(new Date());

  const fetchData = async () => {
    try {
      const [appointmentsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/appointments`).catch(() => null),
        fetch(`${API_BASE}/api/stats`).catch(() => null),
      ]);

      // If backend is down, silently skip this poll cycle
      if (!appointmentsRes || !statsRes || !appointmentsRes.ok || !statsRes.ok) return;

      const appointmentsData = await appointmentsRes.json();
      const statsData = await statsRes.json();
      setAppointments(appointmentsData);
      setStats(statsData);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch {
      // Silently ignore — will retry in 5 seconds
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const serviceCount = Object.keys(stats.byService).length;

  // ── Calendar helpers ──
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const prevMonth = () => setCalendarDate(new Date(calYear, calMonth - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(calYear, calMonth + 1, 1));

  // Build a map: dayOfMonth -> appointments[]
  const appointmentsByDate: Record<number, Appointment[]> = {};
  appointments.filter(a => a.status === 'confirmed').forEach(apt => {
    const dateNum = getDateForDay(apt.day, calendarDate);
    if (dateNum) {
      if (!appointmentsByDate[dateNum]) appointmentsByDate[dateNum] = [];
      appointmentsByDate[dateNum].push(apt);
    }
  });

  // ── Patients: deduplicate by phone ──
  const uniquePatients = Array.from(
    appointments.reduce((map, apt) => {
      if (!map.has(apt.patientPhone)) {
        map.set(apt.patientPhone, {
          phone: apt.patientPhone,
          name: apt.patientName || 'Unknown',
          age: apt.age || 'N/A',
          gender: apt.gender || 'N/A',
          address: apt.address || 'N/A',
          appointmentCount: 0,
          lastService: apt.service,
          lastBookedAt: apt.bookedAt,
        });
      }
      const p = map.get(apt.patientPhone)!;
      p.appointmentCount++;
      // Prefer the latest name if available
      if (apt.patientName && apt.patientName !== 'Unknown') p.name = apt.patientName;
      if (apt.age && apt.age !== 'N/A') p.age = apt.age;
      if (apt.gender && apt.gender !== 'N/A') p.gender = apt.gender;
      if (apt.address && apt.address !== 'N/A') p.address = apt.address;
      if (new Date(apt.bookedAt) > new Date(p.lastBookedAt)) {
        p.lastService = apt.service;
        p.lastBookedAt = apt.bookedAt;
      }
      return map;
    }, new Map<string, { phone: string; name: string; age: string; gender: string; address: string; appointmentCount: number; lastService: string; lastBookedAt: string }>())
    .values()
  );

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>🏥</div>

        <button
          className={`${styles.sidebarItem} ${currentView === 'dashboard' ? styles.sidebarItemActive : ''}`}
          title="Dashboard"
          onClick={() => setCurrentView('dashboard')}
        >📊</button>

        <button
          className={`${styles.sidebarItem} ${currentView === 'calendar' ? styles.sidebarItemActive : ''}`}
          title="Calendar"
          onClick={() => setCurrentView('calendar')}
        >📅</button>

        <button
          className={`${styles.sidebarItem} ${currentView === 'patients' ? styles.sidebarItemActive : ''}`}
          title="Patients"
          onClick={() => setCurrentView('patients')}
        >👥</button>

        <div className={styles.sidebarSpacer}></div>
        <button className={styles.sidebarItem} title="Settings">⚙️</button>
      </aside>

      {/* ── Main Content ── */}
      <main className={styles.main}>
        {/* Top Bar */}
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <h1>
              {currentView === 'dashboard' && 'Dashboard'}
              {currentView === 'calendar' && 'Appointment Calendar'}
              {currentView === 'patients' && 'Patients'}
            </h1>
            <p>
              {currentView === 'dashboard' && "Welcome back — here's your clinic overview"}
              {currentView === 'calendar' && 'View scheduled appointments by date'}
              {currentView === 'patients' && 'All registered patients'}
            </p>
          </div>
          <div className={styles.topBarRight}>
            {lastUpdated && <span className={styles.refreshBadge}>Updated {lastUpdated}</span>}
            <div className={styles.liveIndicator}>
              <span className={styles.liveDot}></span>
              Live
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            VIEW: DASHBOARD
        ════════════════════════════════════════════════ */}
        {currentView === 'dashboard' && (
          <>
            {/* Stats Cards */}
            <section className={styles.statsGrid}>
              <div className={`${styles.statCard} ${styles.fadeIn}`}>
                <div className={styles.statTop}>
                  <div className={`${styles.statIcon} ${styles.statIconBlue}`}>📋</div>
                </div>
                <div className={styles.statValue}>{stats.total}</div>
                <div className={styles.statLabel}>Total Appointments</div>
              </div>
              <div className={`${styles.statCard} ${styles.fadeIn}`}>
                <div className={styles.statTop}>
                  <div className={`${styles.statIcon} ${styles.statIconGreen}`}>✅</div>
                </div>
                <div className={styles.statValue}>{stats.confirmed}</div>
                <div className={styles.statLabel}>Confirmed</div>
              </div>
              <div className={`${styles.statCard} ${styles.fadeIn}`}>
                <div className={styles.statTop}>
                  <div className={`${styles.statIcon} ${styles.statIconRed}`}>❌</div>
                </div>
                <div className={styles.statValue}>{stats.cancelled}</div>
                <div className={styles.statLabel}>Cancelled</div>
              </div>
              <div className={`${styles.statCard} ${styles.fadeIn}`}>
                <div className={styles.statTop}>
                  <div className={`${styles.statIcon} ${styles.statIconPurple}`}>🩺</div>
                </div>
                <div className={styles.statValue}>{serviceCount}</div>
                <div className={styles.statLabel}>Service Types</div>
              </div>
            </section>

            {/* Appointments Table */}
            <section className={styles.tableSection}>
              <div className={styles.tableHeader}>
                <h2 className={styles.tableTitle}>
                  Recent Appointments
                  <span className={styles.tableCount}>({appointments.length})</span>
                </h2>
              </div>
              {appointments.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📱</div>
                  <p className={styles.emptyText}>No appointments yet</p>
                  <p className={styles.emptySubtext}>Text your Linq sandbox number to book an appointment and watch it appear here in real-time!</p>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Service</th>
                      <th>Schedule</th>
                      <th>Status</th>
                      <th>Booked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((apt) => (
                      <tr key={apt.id} onClick={() => setSelectedAppointment(apt)}>
                        <td>
                          <div className={styles.patientCell}>
                            <div className={styles.patientAvatar}>{getInitials(apt.patientName)}</div>
                            <div>
                              <div className={styles.patientName}>{apt.patientName || 'Unknown'}</div>
                              <div className={styles.patientSub}>{apt.gender || ''}{apt.age ? ` · Age ${apt.age}` : ''}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className={styles.servicePill}>🩺 {apt.service}</span></td>
                        <td>
                          <div className={styles.scheduleText}>{apt.day}</div>
                          <div className={styles.scheduleTime}>{apt.time}</div>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${apt.status === 'confirmed' ? styles.badgeConfirmed : styles.badgeCancelled}`}>
                            {apt.status === 'confirmed' ? '✅' : '❌'} {apt.status}
                          </span>
                        </td>
                        <td className={styles.timeText}>{formatTime(apt.bookedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}

        {/* ════════════════════════════════════════════════
            VIEW: CALENDAR
        ════════════════════════════════════════════════ */}
        {currentView === 'calendar' && (
          <section className={styles.calendarSection}>
            {/* Calendar Nav */}
            <div className={styles.calendarNav}>
              <button className={styles.calNavBtn} onClick={prevMonth}>◀</button>
              <h2 className={styles.calMonthTitle}>{MONTH_NAMES[calMonth]} {calYear}</h2>
              <button className={styles.calNavBtn} onClick={nextMonth}>▶</button>
            </div>

            {/* Day headers */}
            <div className={styles.calGrid}>
              {DAY_NAMES.map(d => (
                <div key={d} className={styles.calDayHeader}>{d}</div>
              ))}

              {/* Empty slots before 1st */}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className={styles.calDayEmpty}></div>
              ))}

              {/* Actual days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dayAppts = appointmentsByDate[dayNum] || [];
                const isToday =
                  dayNum === new Date().getDate() &&
                  calMonth === new Date().getMonth() &&
                  calYear === new Date().getFullYear();

                return (
                  <div
                    key={dayNum}
                    className={`${styles.calDay} ${isToday ? styles.calDayToday : ''} ${dayAppts.length > 0 ? styles.calDayHasAppts : ''}`}
                  >
                    <span className={styles.calDayNum}>{dayNum}</span>
                    {dayAppts.slice(0, 3).map((apt, idx) => (
                      <div
                        key={idx}
                        className={styles.calApptChip}
                        onClick={() => setSelectedAppointment(apt)}
                        title={`${apt.patientName} — ${apt.service} at ${apt.time}`}
                      >
                        <span className={styles.calApptDot}></span>
                        {apt.patientName || 'Patient'}
                      </div>
                    ))}
                    {dayAppts.length > 3 && (
                      <div className={styles.calApptMore}>+{dayAppts.length - 3} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════
            VIEW: PATIENTS
        ════════════════════════════════════════════════ */}
        {currentView === 'patients' && (
          <section className={styles.tableSection}>
            <div className={styles.tableHeader}>
              <h2 className={styles.tableTitle}>
                All Patients
                <span className={styles.tableCount}>({uniquePatients.length})</span>
              </h2>
            </div>
            {uniquePatients.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👥</div>
                <p className={styles.emptyText}>No patients yet</p>
                <p className={styles.emptySubtext}>Patients will appear here once they book their first appointment.</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Phone</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Address</th>
                    <th>Visits</th>
                    <th>Last Service</th>
                  </tr>
                </thead>
                <tbody>
                  {uniquePatients.map((p) => (
                    <tr key={p.phone}>
                      <td>
                        <div className={styles.patientCell}>
                          <div className={styles.patientAvatar}>{getInitials(p.name)}</div>
                          <div className={styles.patientName}>{p.name}</div>
                        </div>
                      </td>
                      <td className={styles.phoneText}>{p.phone}</td>
                      <td>{p.age}</td>
                      <td>{p.gender}</td>
                      <td className={styles.addressText}>{p.address}</td>
                      <td>
                        <span className={styles.visitBadge}>{p.appointmentCount}</span>
                      </td>
                      <td><span className={styles.servicePill}>🩺 {p.lastService}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </main>

      {/* ── Patient Detail Modal ── */}
      {selectedAppointment && (
        <div className={styles.modalOverlay} onClick={() => setSelectedAppointment(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Patient Details</h3>
              <button className={styles.modalClose} onClick={() => setSelectedAppointment(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Full Name</span>
                  <span className={styles.detailValue}>{selectedAppointment.patientName || 'N/A'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Phone</span>
                  <span className={styles.detailValue}>{selectedAppointment.patientPhone}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Age</span>
                  <span className={styles.detailValue}>{selectedAppointment.age || 'N/A'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Gender</span>
                  <span className={styles.detailValue}>{selectedAppointment.gender || 'N/A'}</span>
                </div>
                <div className={`${styles.detailItem} ${styles.detailItemFull}`}>
                  <span className={styles.detailLabel}>Address</span>
                  <span className={styles.detailValue}>📍 {selectedAppointment.address || 'N/A'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Service</span>
                  <span className={styles.detailValue}>🩺 {selectedAppointment.service}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Appointment</span>
                  <span className={styles.detailValue}>📅 {selectedAppointment.day} at {selectedAppointment.time}</span>
                </div>
              </div>
            </div>
            <div className={styles.modalStatusBar}>
              <span className={`${styles.badge} ${selectedAppointment.status === 'confirmed' ? styles.badgeConfirmed : styles.badgeCancelled}`}>
                {selectedAppointment.status === 'confirmed' ? '✅' : '❌'} {selectedAppointment.status}
              </span>
              <span className={styles.timeText}>Booked {formatTime(selectedAppointment.bookedAt)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
