import React, { useState } from 'react';
import { fetchHospitalReportById, ExternalHospitalReport } from '../services/HospitalExchangeService';
import { Building2, Search, CheckCircle2, ArrowRight, ShieldCheck, Download, AlertCircle, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface HospitalIDImporterProps {
  onImportComplete: (report: ExternalHospitalReport) => void;
}

export const HospitalIDImporter: React.FC<HospitalIDImporterProps> = ({ onImportComplete }) => {
  const [accessionId, setAccessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedData, setFetchedData] = useState<ExternalHospitalReport | null>(null);

  const handleSearch = async (targetId?: string) => {
    const idToSearch = targetId || accessionId;
    if (!idToSearch.trim()) {
      setError('Please provide a valid Hospital Accession / Record ID.');
      return;
    }

    setLoading(true);
    setError(null);
    setFetchedData(null);

    const report = await fetchHospitalReportById(idToSearch);
    setLoading(false);

    if (report) {
      setFetchedData(report);
      setAccessionId(report.accessionId);
    } else {
      setError(`Record ID "${idToSearch}" not found. Try one of the demo hospital IDs below.`);
    }
  };

  const handleMergeRecord = () => {
    if (!fetchedData) return;
    onImportComplete(fetchedData);
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.5 } });
    setFetchedData(null);
    setAccessionId('');
  };

  const sampleIds = [
    { label: 'Apollo Hospital', id: 'APOLLO-CARD-9942' },
    { label: 'Manipal Hospital', id: 'MANIPAL-LAB-4401' },
    { label: 'Narayana Health', id: 'NARAYANA-PULM-7712' },
    { label: 'Fortis Hospital', id: 'FORTIS-MR-2089' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Universal Hospital Network Sync (HIE Gateway)</span>
              <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded-full font-bold">
                Auto-Fill
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Enter any hospital record ID to pull verified diagnosis, vitals, and reports automatically.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded-lg">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>FHIR HIE Protocol</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={accessionId}
            onChange={(e) => setAccessionId(e.target.value.toUpperCase())}
            placeholder="e.g. APOLLO-CARD-9942 or MANIPAL-LAB-4401"
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 font-mono outline-none focus:border-cyan-500 transition-all uppercase"
          />
        </div>
        <button
          onClick={() => handleSearch()}
          disabled={loading}
          className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Querying Node...</span>
            </>
          ) : (
            <>
              <span>Fetch & Auto-Fill</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      <div>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-1.5">
          Quick Demo Hospital Accession IDs:
        </span>
        <div className="flex flex-wrap gap-2">
          {sampleIds.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setAccessionId(item.id);
                handleSearch(item.id);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500 text-[11px] text-slate-300 hover:text-cyan-300 font-mono transition-all text-left"
            >
              <strong className="text-cyan-400">{item.id}</strong> ({item.label.split(' ')[0]})
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {fetchedData && (
        <div className="p-5 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white">{fetchedData.hospitalName}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  {fetchedData.accessionId}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">{fetchedData.hospitalBranch} • {fetchedData.department}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-300 font-medium">Attending: <strong>{fetchedData.doctorName}</strong></span>
              <div className="text-[10px] text-slate-500">Date: {fetchedData.testDate}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold">BP</span>
              <div className="text-sm font-bold text-white mt-0.5">{fetchedData.vitals.bloodPressure}</div>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Heart Rate</span>
              <div className="text-sm font-bold text-white mt-0.5">{fetchedData.vitals.heartRate}</div>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Glucose</span>
              <div className="text-sm font-bold text-white mt-0.5">{fetchedData.vitals.bloodSugar}</div>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold">SpO2</span>
              <div className="text-sm font-bold text-white mt-0.5">{fetchedData.vitals.spo2}</div>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Official Diagnosis</span>
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-cyan-300 font-bold">
              {fetchedData.diagnosis}
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Clinical Findings</span>
            <p className="text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
              {fetchedData.summary}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center pt-3 border-t border-slate-800 gap-3">
            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Attached: <strong className="text-slate-200">{fetchedData.pdfName}</strong> ({fetchedData.pdfSize})</span>
            </div>
            <button
              onClick={handleMergeRecord}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Import & Sync into My Record</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
