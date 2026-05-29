import { useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { SwipeCardHandle } from '../components/SwipeCard';
import SwipeCard from '../components/SwipeCard';
import type { MockJobCard, MockAssistantCard } from '../utils/mockTestData';
import {
  MOCK_JOB_CARDS, MOCK_ASSISTANT_CARDS,
  softwareLabel,
} from '../utils/mockTestData';

type Persona = 'ASSISTANT' | 'CLINIC';
type SwipedCard = MockJobCard | MockAssistantCard;

// ── Availability Grid ─────────────────────────────────────────────────────────
const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN'] as const;
const DAY_LABEL: Record<string, string> = {
  MON:'M', TUE:'T', WED:'W', THU:'T', FRI:'F', SAT:'S', SUN:'S'
};

const SLOT_STYLE = {
  full: 'bg-emerald-400',
  am:   'bg-emerald-400/60',
  pm:   'bg-blue-400/60',
  off:  'bg-gray-200',
};

function AvailGrid({ avail }: { avail: MockAssistantCard['availability'] }) {
  return (
    <div className="flex gap-1 mt-1">
      {DAYS.map((d) => (
        <div key={d} className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] text-gray-400 font-medium">{DAY_LABEL[d]}</span>
          <div className={`w-5 h-5 rounded-sm ${SLOT_STYLE[avail[d]]}`} />
        </div>
      ))}
    </div>
  );
}

// ── Software Chip ─────────────────────────────────────────────────────────────
function SoftBadge({ s }: { s: string }) {
  return (
    <span className="text-[11px] bg-white/20 text-white font-medium px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/30">
      {softwareLabel(s)}
    </span>
  );
}
function SoftChip({ s }: { s: string }) {
  return (
    <span className="text-[11px] bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-full">
      {softwareLabel(s)}
    </span>
  );
}

// ── Job Card Content (Assistant View) ────────────────────────────────────────
function JobCardContent({ card }: { card: MockJobCard }) {
  const isTemp = card.type === 'TEMP';
  const locationLine = [card.city, card.state, card.country !== 'US' ? card.country : '']
    .filter(Boolean).join(', ');

  return (
    <div className="h-full w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col bg-white cursor-grab active:cursor-grabbing select-none">
      {/* Header */}
      <div
        className="relative flex flex-col justify-between p-5 pt-6"
        style={{
          background: isTemp
            ? `linear-gradient(135deg, ${card.accentColor} 0%, #fb923c 100%)`
            : `linear-gradient(135deg, ${card.accentColor} 0%, #16a34a 100%)`,
          minHeight: '210px',
        }}
      >
        {/* Type badge */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white/90 bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest border border-white/30">
            {isTemp ? '⚡ Temp Shift' : '🏢 Permanent Role'}
          </span>
          {card.slots && card.slots > 1 && (
            <span className="text-xs text-white/80 font-medium">{card.slots} openings</span>
          )}
        </div>

        {/* Rate + duration */}
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-white">${card.hourlyRate}</span>
            <span className="text-white/80 text-lg font-medium">/hr</span>
            {isTemp && card.shiftDuration && (
              <span className="ml-2 text-white/70 text-sm font-medium">· {card.shiftDuration}</span>
            )}
          </div>
          {!isTemp && (
            <p className="text-white/70 text-sm mt-0.5">Full-time · All benefits included</p>
          )}
        </div>

        {/* Software badges */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {card.software.map((s) => <SoftBadge key={s} s={s} />)}
          {card.requiredTier && (
            <span className="text-[11px] bg-white/30 text-white font-bold px-2 py-0.5 rounded-full border border-white/40">
              {card.requiredTier} required
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-5 flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{card.clinicName}</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {card.address} · {locationLine}
          </p>
        </div>

        {isTemp && card.shiftDate && (
          <div className="flex items-center gap-2 bg-orange-50 rounded-xl px-3 py-2.5">
            <span className="text-orange-500 text-lg">📅</span>
            <div>
              <p className="text-sm font-semibold text-orange-700">{card.shiftDate}</p>
              <p className="text-xs text-orange-500">{card.shiftHours}</p>
            </div>
          </div>
        )}

        {!isTemp && (
          <div className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2.5">
            <span className="text-green-500 text-lg">🚀</span>
            <div>
              <p className="text-sm font-semibold text-green-700">Career Growth Role</p>
              <p className="text-xs text-green-500">Long-term opportunity · Stable schedule</p>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 flex-1">
          {card.description}
        </p>
      </div>
    </div>
  );
}

// ── Talent Card Content (Clinic View) ────────────────────────────────────────
function TalentCardContent({ card }: { card: MockAssistantCard }) {
  return (
    <div className="h-full w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col bg-white cursor-grab active:cursor-grabbing select-none">
      {/* Header */}
      <div
        className="relative flex flex-col justify-between p-5 pt-6"
        style={{
          background: `linear-gradient(135deg, ${card.accentColor} 0%, ${card.accentColor}cc 100%)`,
          minHeight: '200px',
        }}
      >
        {/* Avatar + tier */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/25 flex items-center justify-center text-xl font-black text-white border-2 border-white/40">
              {card.initials}
            </div>
            <div>
              <h2 className="text-xl font-black text-white">{card.displayName}</h2>
              <span className="text-xs font-bold text-white/80 bg-white/20 px-2 py-0.5 rounded-full border border-white/30">
                {card.tier}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-white">${card.hourlyRate}<span className="text-sm font-normal text-white/70">/hr</span></p>
            <p className="text-xs text-white/70">{card.yearsExp} yr{card.yearsExp !== 1 ? 's' : ''} exp</p>
          </div>
        </div>

        {/* Software */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {card.software.map((s) => <SoftBadge key={s} s={s} />)}
        </div>

        {/* Travel radius */}
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-white/70 text-xs">📍 Within {card.travelRadius} mi</span>
          {card.openToPermanent && (
            <span className="text-xs text-white font-semibold bg-white/25 px-2 py-0.5 rounded-full border border-white/30 ml-2">
              Open to Perm
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-5 flex flex-col gap-3">
        {/* Availability Grid */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Weekly Availability</p>
          <AvailGrid avail={card.availability} />
          <div className="flex gap-3 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Full day</span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/60 inline-block" /> AM only</span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400/60 inline-block" /> PM only</span>
          </div>
        </div>

        <div className="h-px bg-gray-100" />

        {/* Software chips (smaller, readable) */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Software</p>
          <div className="flex flex-wrap gap-1.5">
            {card.software.map((s) => <SoftChip key={s} s={s} />)}
          </div>
        </div>

        <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 flex-1">{card.bio}</p>
      </div>
    </div>
  );
}

// ── Detail Sheet ─────────────────────────────────────────────────────────────
function DetailSheet({
  card, persona, onClose,
}: {
  card: SwipedCard;
  persona: Persona;
  onClose: () => void;
}) {
  const isJob = persona === 'ASSISTANT';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Dim backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />

      <motion.div
        className="relative z-10 w-full max-w-sm bg-white rounded-t-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 340, damping: 30 } }}
        exit={{ y: '100%', transition: { duration: 0.22 } }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {isJob ? (
            <JobDetail card={card as MockJobCard} onClose={onClose} />
          ) : (
            <TalentDetail card={card as MockAssistantCard} onClose={onClose} />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function JobDetail({ card, onClose }: { card: MockJobCard; onClose: () => void }) {
  const isTemp = card.type === 'TEMP';
  const locationLine = [card.city, card.state, card.country && card.country !== 'US' ? card.country : '']
    .filter(Boolean).join(', ');
  const [applied, setApplied] = useState(false);

  return (
    <>
      {/* Gradient header */}
      <div
        className="px-5 pt-4 pb-5"
        style={{
          background: isTemp
            ? `linear-gradient(135deg, ${card.accentColor} 0%, #fb923c 100%)`
            : `linear-gradient(135deg, ${card.accentColor} 0%, #16a34a 100%)`,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-white/90 bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest border border-white/30">
            {isTemp ? '⚡ Temp Shift' : '🏢 Permanent Role'}
          </span>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl font-light">✕</button>
        </div>
        <h2 className="text-2xl font-black text-white leading-tight">{card.clinicName}</h2>
        <p className="text-white/70 text-sm mt-1">{card.address} · {locationLine}</p>
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-4xl font-black text-white">${card.hourlyRate}</span>
          <span className="text-white/80 text-base">/hr</span>
          {isTemp && card.shiftDuration && (
            <span className="text-white/60 text-sm ml-1">· {card.shiftDuration}</span>
          )}
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Shift time */}
        {isTemp && card.shiftDate && (
          <div className="flex items-center gap-3 bg-orange-50 rounded-2xl px-4 py-3">
            <span className="text-2xl">📅</span>
            <div>
              <p className="font-semibold text-orange-700">{card.shiftDate}</p>
              <p className="text-sm text-orange-500">{card.shiftHours}</p>
            </div>
          </div>
        )}

        {!isTemp && (
          <div className="flex items-center gap-3 bg-green-50 rounded-2xl px-4 py-3">
            <span className="text-2xl">🚀</span>
            <div>
              <p className="font-semibold text-green-700">Full-Time Permanent</p>
              <p className="text-sm text-green-500">Long-term opportunity · Stable schedule</p>
            </div>
          </div>
        )}

        {/* Requirements */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Requirements</p>
          <div className="flex flex-wrap gap-2">
            {card.requiredTier && (
              <span className="text-sm bg-purple-100 text-purple-700 font-semibold px-3 py-1 rounded-full">
                {card.requiredTier} required
              </span>
            )}
            {!card.requiredTier && (
              <span className="text-sm bg-gray-100 text-gray-500 font-medium px-3 py-1 rounded-full">
                Any tier welcome
              </span>
            )}
            {card.software.map((s) => (
              <span key={s} className="text-sm bg-blue-50 text-blue-600 font-medium px-3 py-1 rounded-full">
                {softwareLabel(s)}
              </span>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">About This Role</p>
          <p className="text-sm text-gray-600 leading-relaxed">{card.description}</p>
        </div>

        {/* CTA */}
        <button
          onClick={() => setApplied(true)}
          disabled={applied}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all mt-1 mb-2 ${
            applied
              ? 'bg-emerald-100 text-emerald-700 cursor-default'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200 active:scale-[0.98]'
          }`}
        >
          {applied ? '✓ Application Sent!' : 'Apply Now'}
        </button>
      </div>
    </>
  );
}

function TalentDetail({ card, onClose }: { card: MockAssistantCard; onClose: () => void }) {
  const [connected, setConnected] = useState(false);

  return (
    <>
      {/* Gradient header */}
      <div
        className="px-5 pt-4 pb-5"
        style={{ background: `linear-gradient(135deg, ${card.accentColor} 0%, ${card.accentColor}cc 100%)` }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/25 flex items-center justify-center text-xl font-black text-white border-2 border-white/40">
              {card.initials}
            </div>
            <div>
              <h2 className="text-xl font-black text-white">{card.displayName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold text-white/80 bg-white/20 px-2 py-0.5 rounded-full border border-white/30">{card.tier}</span>
                <span className="text-xs text-white/70">{card.yearsExp} yr{card.yearsExp !== 1 ? 's' : ''} exp</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl font-light">✕</button>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <span className="text-2xl font-black text-white">${card.hourlyRate}<span className="text-sm font-normal text-white/70">/hr</span></span>
          <span className="text-white/60 text-sm">·</span>
          <span className="text-white/80 text-sm">📍 Within {card.travelRadius} mi</span>
          {card.openToPermanent && (
            <span className="text-xs text-white font-semibold bg-white/25 px-2 py-0.5 rounded-full border border-white/30">Open to Perm</span>
          )}
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Availability */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Weekly Availability</p>
          <AvailGrid avail={card.availability} />
          <div className="flex gap-3 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Full day</span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/60 inline-block" /> AM only</span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400/60 inline-block" /> PM only</span>
          </div>
        </div>

        <div className="h-px bg-gray-100" />

        {/* Software */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Software</p>
          <div className="flex flex-wrap gap-2">
            {card.software.map((s) => (
              <span key={s} className="text-sm bg-blue-50 text-blue-600 font-medium px-3 py-1 rounded-full">
                {softwareLabel(s)}
              </span>
            ))}
          </div>
        </div>

        {/* Bio */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">About</p>
          <p className="text-sm text-gray-600 leading-relaxed">{card.bio}</p>
        </div>

        {/* CTA */}
        <button
          onClick={() => setConnected(true)}
          disabled={connected}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all mt-1 mb-2 ${
            connected
              ? 'bg-emerald-100 text-emerald-700 cursor-default'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200 active:scale-[0.98]'
          }`}
        >
          {connected ? '✓ Request Sent!' : 'Connect'}
        </button>
      </div>
    </>
  );
}

// ── Match Popup ───────────────────────────────────────────────────────────────
function MatchPopup({
  card, persona, onClose, onViewDetails,
}: {
  card: SwipedCard;
  persona: Persona;
  onClose: () => void;
  onViewDetails: () => void;
}) {
  const isJob = persona === 'ASSISTANT';
  const title = isJob
    ? (card as MockJobCard).clinicName
    : (card as MockAssistantCard).displayName;
  const subtitle = isJob
    ? `${(card as MockJobCard).type === 'TEMP' ? 'Temp Shift' : 'Permanent Role'} · $${(card as MockJobCard).hourlyRate}/hr`
    : `${(card as MockAssistantCard).tier} · ${(card as MockAssistantCard).yearsExp} yrs · $${(card as MockAssistantCard).hourlyRate}/hr`;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-emerald-600 via-emerald-500 to-teal-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />

      {/* Confetti dots */}
      {[...Array(18)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: ['#fff', '#fde68a', '#a7f3d0', '#fbcfe8', '#bfdbfe'][i % 5],
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 60}%`,
          }}
          initial={{ y: -20, opacity: 0, scale: 0 }}
          animate={{
            y: [0, 80 + Math.random() * 120],
            opacity: [1, 1, 0],
            scale: [1, 1.2, 0.8],
            x: [(Math.random() - 0.5) * 60],
          }}
          transition={{ duration: 1.4 + Math.random() * 0.8, delay: Math.random() * 0.3 }}
        />
      ))}

      <motion.div
        className="relative z-10 w-full max-w-sm mx-4 mb-8 sm:mb-0 bg-white rounded-3xl shadow-2xl overflow-hidden"
        initial={{ y: 120, scale: 0.9, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 340, damping: 26, delay: 0.05 } }}
        exit={{ y: 60, opacity: 0, transition: { duration: 0.2 } }}
      >
        {/* Green top band */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-400 px-6 pt-8 pb-6 text-center">
          <motion.div
            className="text-5xl mb-2"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 400, damping: 18, delay: 0.15 } }}
          >
            🎉
          </motion.div>
          <motion.h2
            className="text-2xl font-black text-white"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
          >
            It's a Match!
          </motion.h2>
          <motion.p
            className="text-emerald-100 text-sm mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.28 } }}
          >
            {isJob ? 'Your application has been sent' : 'You connected with this talent'}
          </motion.p>
        </div>

        {/* Card summary */}
        <motion.div
          className="px-6 py-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
        >
          <p className="font-bold text-gray-900 text-base">{title}</p>
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        </motion.div>

        {/* Actions */}
        <motion.div
          className="px-6 pb-6 flex gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.38 } }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Keep Swiping
          </button>
          <button
            onClick={onViewDetails}
            className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors shadow-lg shadow-emerald-200"
          >
            View Details →
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ── Empty Deck ────────────────────────────────────────────────────────────────
function EmptyDeck({ persona, onReset }: { persona: Persona; onReset: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-center px-8 gap-4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="text-6xl">🌵</div>
      <h3 className="text-xl font-bold text-gray-700">You've seen them all!</h3>
      <p className="text-sm text-gray-400 leading-relaxed">
        {persona === 'ASSISTANT'
          ? 'No more active listings in your area. Check back soon or broaden your radius.'
          : 'No more available assistants in your area right now. Try adjusting your filters.'}
      </p>
      <button
        onClick={onReset}
        className="mt-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-blue-200 transition-colors"
      >
        Start Over
      </button>
    </motion.div>
  );
}

// ── Swipe Deck ────────────────────────────────────────────────────────────────
function SwipeDeck({ persona }: { persona: Persona }) {
  const isAssistant = persona === 'ASSISTANT';
  const initialCards = isAssistant
    ? [...MOCK_JOB_CARDS]
    : [...MOCK_ASSISTANT_CARDS];

  const [deck, setDeck] = useState<(MockJobCard | MockAssistantCard)[]>(initialCards);
  const [matchedCard, setMatchedCard] = useState<SwipedCard | null>(null);
  const [detailCard, setDetailCard] = useState<SwipedCard | null>(null);
  const [lastAction, setLastAction] = useState<'left' | 'right' | null>(null);
  const topCardRef = useRef<SwipeCardHandle>(null);

  const handleSwipe = useCallback((dir: 'left' | 'right', card: SwipedCard) => {
    setLastAction(dir);
    if (dir === 'right') setMatchedCard(card);
    setTimeout(() => setDeck((prev) => prev.slice(1)), 50);
  }, []);

  const reset = () => {
    setDeck(initialCards);
    setLastAction(null);
  };

  const triggerLeft  = () => topCardRef.current?.swipeLeft();
  const triggerRight = () => topCardRef.current?.swipeRight();

  const isEmpty = deck.length === 0;

  return (
    <div className="flex flex-col items-center w-full h-full">
      {/* Deck area */}
      <div className="relative w-full max-w-sm" style={{ height: '520px' }}>
        {isEmpty ? (
          <EmptyDeck persona={persona} onReset={reset} />
        ) : (
          <>
            {/* Render cards from bottom of stack to top */}
            {[...deck.slice(0, 3)].reverse().map((card, reversedIdx) => {
              const stackIndex = Math.min(deck.slice(0, 3).length - 1 - reversedIdx, 2);
              return (
                <SwipeCard
                  key={card.id}
                  ref={stackIndex === 0 ? topCardRef : undefined}
                  stackIndex={stackIndex}
                  onSwipe={(dir) => handleSwipe(dir, card)}
                >
                  {isAssistant
                    ? <JobCardContent card={card as MockJobCard} />
                    : <TalentCardContent card={card as MockAssistantCard} />
                  }
                </SwipeCard>
              );
            })}
          </>
        )}
      </div>

      {/* Counter */}
      {!isEmpty && (
        <p className="text-xs text-gray-400 mt-2 mb-3 font-medium">
          {deck.length} remaining
        </p>
      )}

      {/* Action buttons */}
      {!isEmpty && (
        <div className="flex items-center gap-6 mt-1">
          <button
            onClick={triggerLeft}
            className="w-14 h-14 rounded-full bg-white shadow-lg shadow-red-100 border-2 border-red-100 flex items-center justify-center text-2xl hover:scale-110 hover:shadow-red-200 active:scale-95 transition-all"
            title="Pass"
          >
            ✕
          </button>

          {/* Middle: undo-style indicator */}
          <div className="flex flex-col items-center gap-0.5 opacity-40">
            <div className={`w-2 h-2 rounded-full transition-colors ${lastAction === 'left' ? 'bg-red-400' : lastAction === 'right' ? 'bg-emerald-400' : 'bg-gray-300'}`} />
            <p className="text-[10px] text-gray-400 font-medium">
              {lastAction === 'left' ? 'Passed' : lastAction === 'right' ? 'Applied' : 'Swipe!'}
            </p>
          </div>

          <button
            onClick={triggerRight}
            className="w-14 h-14 rounded-full bg-white shadow-lg shadow-emerald-100 border-2 border-emerald-100 flex items-center justify-center text-2xl hover:scale-110 hover:shadow-emerald-200 active:scale-95 transition-all"
            title="Apply / Match"
          >
            ✓
          </button>
        </div>
      )}

      {/* Match Popup */}
      <AnimatePresence>
        {matchedCard && (
          <MatchPopup
            key="match"
            card={matchedCard}
            persona={persona}
            onClose={() => setMatchedCard(null)}
            onViewDetails={() => {
              setDetailCard(matchedCard);
              setMatchedCard(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Detail Sheet */}
      <AnimatePresence>
        {detailCard && (
          <DetailSheet
            key="detail"
            card={detailCard}
            persona={persona}
            onClose={() => setDetailCard(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Bottom Persona Nav ────────────────────────────────────────────────────────
function PersonaNav({
  persona, onChange,
}: {
  persona: Persona;
  onChange: (p: Persona) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 z-40">
      <div className="max-w-sm mx-auto flex">
        {(['ASSISTANT', 'CLINIC'] as Persona[]).map((p) => {
          const active = persona === p;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
                active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-xl">{p === 'ASSISTANT' ? '🔍' : '🏥'}</span>
              <span className="text-[11px] font-semibold tracking-wide">
                {p === 'ASSISTANT' ? 'Job Hunt' : 'Find Talent'}
              </span>
              {active && (
                <motion.div
                  layoutId="persona-indicator"
                  className="absolute bottom-0 h-0.5 w-16 bg-blue-600 rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SwipePage() {
  const [persona, setPersona] = useState<Persona>('ASSISTANT');

  const handlePersonaChange = (p: Persona) => setPersona(p);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 pb-24">
      {/* Header */}
      <div className="w-full max-w-sm px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-900">
              {persona === 'ASSISTANT' ? '🔍 Job Hunt' : '🏥 Find Talent'}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {persona === 'ASSISTANT'
                ? 'Swipe right to apply · left to pass'
                : 'Swipe right to connect · left to pass'}
            </p>
          </div>

          {/* Persona toggle pill */}
          <div className="flex items-center bg-gray-100 rounded-full p-1 gap-1">
            <button
              onClick={() => setPersona('ASSISTANT')}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                persona === 'ASSISTANT' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              }`}
            >
              Asst
            </button>
            <button
              onClick={() => setPersona('CLINIC')}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                persona === 'CLINIC' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              }`}
            >
              Clinic
            </button>
          </div>
        </div>
      </div>

      {/* Deck — remount on persona change to reset state */}
      <div className="w-full max-w-sm px-4 flex flex-col items-center flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={persona}
            className="w-full flex flex-col items-center"
            initial={{ opacity: 0, x: persona === 'ASSISTANT' ? -40 : 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: persona === 'ASSISTANT' ? 40 : -40 }}
            transition={{ duration: 0.22 }}
          >
            <SwipeDeck persona={persona} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom persona nav */}
      <PersonaNav persona={persona} onChange={handlePersonaChange} />
    </div>
  );
}
