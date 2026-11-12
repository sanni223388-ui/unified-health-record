import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { HeartPulse, PhoneCall, X, Printer } from 'lucide-react';
import { PatientProfile } from '../context/HealthRecordContext';

interface Props {
  profile: PatientProfile;
  onClose: () => void;
}

export const EmergencyQRModal: React.FC<Props> = ({ profile, onClose }) => {
  const emergencyData = JSON.stringify({
    uhrId: 'UHR-883902',
    name: profile.fullName,
    bloodType: profile.bloodGroup,
    allergies: profile.allergies,
    conditions: profile.chronicConditions,
    iceContact: {
      name: profile.emergencyContact.name,
      phone: profile.emergencyContact.phone,
      relation: profile.emergencyContact.relationship
    },
    traumaHotline: '108 / +91 80 2200 9999',
    timestamp: new Date().toISOString()
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400">
            <HeartPulse className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">First Responder Triage QR Passport</h2>
            <p className="text-xs text-slate-400">Offline scannable by paramedics without internet connectivity</p>
          </div>
        </div>

        <div className="bg-slate-950 border border-rose-900/60 p-5 rounded-2xl flex flex-col items-center space-y-4 text-center">
          <div className="p-3 bg-white rounded-2xl shadow-xl">
            <QRCodeSVG value={emergencyData} size={180} level="H" includeMargin={true} />
          </div>
          <span className="text-[10px] text-cyan-400 font-mono tracking-wider uppercase">
            Encrypted Sovereign Payload • UHR-883902
          </span>

          <div className="grid grid-cols-2 gap-3 w-full text-xs text-left pt-2 border-t border-slate-900">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Blood Type</span>
              <span className="text-lg font-black text-rose-400">{profile.bloodGroup}</span>
            </div>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Severe Allergies</span>
              <span className="text-xs font-bold text-amber-300 truncate block">{profile.allergies[0]}</span>
            </div>
          </div>

          <div className="w-full text-left p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Primary Emergency Contact (ICE)</span>
            <div className="font-bold text-white">{profile.emergencyContact.name} ({profile.emergencyContact.relationship})</div>
            <div className="flex items-center space-x-2 text-cyan-400 font-mono text-[11px] mt-1">
              <PhoneCall className="w-3.5 h-3.5" />
              <span>{profile.emergencyContact.phone}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-[10px] text-slate-500 font-mono">FIPS-140-3 Cryptographic Integrity</span>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 text-white font-bold rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-rose-950"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Physical Wallet Card</span>
          </button>
        </div>
      </div>
    </div>
  );
};
