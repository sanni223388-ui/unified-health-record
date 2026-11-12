import React, { useState, useEffect } from 'react';
import { useHealthRecord } from '../context/HealthRecordContext';
import {
  Navigation, MapPin, PhoneCall, Calendar,
  Compass, ExternalLink, RefreshCw, CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';

const calculateHaversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
};

interface Props {
  onBookSpecialist?: (doctorName: string, specialty: string) => void;
  isLight: boolean;
}

export const NearbyDoctorRadar: React.FC<Props> = ({ isLight }) => {
  const { doctors, bookAppointment, profile } = useHealthRecord();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({ lat: 12.9716, lng: 77.5946 });
  const [locationLabel, setLocationLabel] = useState<string>('Detecting GPS...');
  const [scanning, setScanning] = useState(false);
  const [maxRadius, setMaxRadius] = useState<number>(25);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('All');

  // Direct Real Appointment Booking Modal State
  const [bookingDoc, setBookingDoc] = useState<any | null>(null);
  const [apptDate, setApptDate] = useState<string>(() => new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [apptTime, setApptTime] = useState<string>('10:30');
  const [apptReason, setApptReason] = useState<string>('General Consultation');
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const startScan = () => {
    setScanning(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const uLat = position.coords.latitude;
          const uLng = position.coords.longitude;
          setUserLocation({ lat: uLat, lng: uLng });
          setLocationLabel(`Live GPS: (${uLat.toFixed(4)}°N, ${uLng.toFixed(4)}°E)`);
          setScanning(false);
        },
        () => {
          setUserLocation({ lat: 12.9716, lng: 77.5946 });
          setLocationLabel('Bengaluru Central Hub (12.9716°N, 77.5946°E)');
          setScanning(false);
        },
        { timeout: 6000, enableHighAccuracy: true }
      );
    } else {
      setScanning(false);
    }
  };

  useEffect(() => {
    startScan();
  }, []);

  const enrichedDoctors = doctors
    .map((doc) => ({
      ...doc,
      distanceKm: calculateHaversineKm(userLocation.lat, userLocation.lng, doc.lat, doc.lng)
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const specialties = ['All', ...Array.from(new Set(doctors.map((d) => d.specialty)))];

  const filteredDoctors = enrichedDoctors.filter((doc) => {
    const matchesSpec = selectedSpecialty === 'All' || doc.specialty === selectedSpecialty;
    const withinUserRadius = doc.distanceKm <= maxRadius;
    return matchesSpec && withinUserRadius;
  });

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDoc) return;
    setSubmittingBooking(true);
    const res = await bookAppointment({
      patientId: 'self',
      patientName: profile.fullName,
      doctorId: bookingDoc.id,
      doctorName: bookingDoc.name,
      doctorSpecialty: bookingDoc.specialty,
      date: apptDate,
      time: apptTime,
      type: apptReason
    });
    setSubmittingBooking(false);
    if (res.ok) {
      confetti({ particleCount: 60, spread: 70 });
      setBookingStatus(`Appointment confirmed with ${bookingDoc.name} on ${apptDate} at ${apptTime}!`);
      setTimeout(() => {
        setBookingDoc(null);
        setBookingStatus(null);
      }, 2000);
    } else {
      setBookingStatus(res.message);
    }
  };

  return (
    <div className={`p-6 rounded-3xl border transition-all ${
      isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900 border-slate-800'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Compass className={`w-5 h-5 ${scanning ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h2 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <span>Real Hospital Doctor Directory & Radius Radar</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 font-bold">
                {filteredDoctors.length} Doctors in {maxRadius} km
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>{locationLabel}</span>
            </p>
          </div>
        </div>

        <button
          onClick={startScan}
          disabled={scanning}
          className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
          <span>{scanning ? 'Scanning GPS...' : 'Update GPS'}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-4 text-xs">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
          {specialties.map((spec) => (
            <button
              key={spec}
              onClick={() => setSelectedSpecialty(spec)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all text-[11px] whitespace-nowrap ${
                selectedSpecialty === spec
                  ? 'bg-teal-600 text-white'
                  : isLight
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {spec}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 text-slate-500">
          <span className="text-[11px] font-bold">Radius:</span>
          {[5, 10, 25, 100].map((r) => (
            <button
              key={r}
              onClick={() => setMaxRadius(r)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border ${
                maxRadius === r
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-teal-500/10'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
            >
              {r === 100 ? 'All (100km)' : `${r} km`}
            </button>
          ))}
        </div>
      </div>

      {filteredDoctors.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-700 rounded-2xl">
          No doctors found within {maxRadius} km. Try increasing the radius filter or ask the Hospital Admin to register doctors in your area.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {filteredDoctors.map((doc) => (
            <div
              key={doc.id}
              className={`p-5 rounded-2xl border flex flex-col justify-between space-y-3 transition-all hover:border-teal-500/60 ${
                isLight ? 'bg-slate-50/70 border-slate-200 shadow-xs' : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {doc.name}
                    </h3>
                    <div className="text-teal-600 dark:text-cyan-400 text-xs font-semibold">
                      {doc.specialty}
                    </div>
                  </div>
                  <span className="flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                    <Navigation className="w-3 h-3 text-teal-500" />
                    <span>{doc.distanceKm} km</span>
                  </span>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <div className="flex items-center space-x-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{doc.hospital} ({doc.area})</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <PhoneCall className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="font-mono">{doc.phone || 'Hospital Desk'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-mono text-slate-400">Radius: {doc.radiusKm} km</span>
                  <span className="text-emerald-600 font-bold">Fee: {doc.fee}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${doc.lat},${doc.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`py-2 px-3 rounded-xl border text-[11px] font-bold flex items-center justify-center space-x-1.5 ${
                      isLight
                        ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Map</span>
                  </a>

                  <button
                    onClick={() => {
                      setBookingDoc(doc);
                      setBookingStatus(null);
                    }}
                    className="py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold flex items-center justify-center space-x-1 shadow-sm"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>Book Slot</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Real Appointment Booking Modal */}
      {bookingDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleConfirmBooking} className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs text-slate-100">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Book Real Appointment</h3>
                <p className="text-teal-400">{bookingDoc.name} • {bookingDoc.specialty} ({bookingDoc.hospital})</p>
              </div>
              <button type="button" onClick={() => setBookingDoc(null)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            {bookingStatus && (
              <div className="p-3 bg-emerald-950 border border-emerald-500 text-emerald-200 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{bookingStatus}</span>
              </div>
            )}

            <div>
              <label className="block text-slate-400 mb-1">Appointment Date *</label>
              <input type="date" required value={apptDate} onChange={e => setApptDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Preferred Time *</label>
              <input type="time" required value={apptTime} onChange={e => setApptTime(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Reason for Visit *</label>
              <input type="text" required value={apptReason} onChange={e => setApptReason(e.target.value)} placeholder="e.g. Fever & general checkup" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setBookingDoc(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">
                Cancel
              </button>
              <button type="submit" disabled={submittingBooking} className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold">
                {submittingBooking ? 'Confirming...' : 'Confirm Booking'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
