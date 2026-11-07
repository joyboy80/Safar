import { CheckCircle2, Clock, Ticket, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Select from "../../components/common/Select";
import SeatMap from "../../components/reservation/SeatMap";
import PageHeader from "../../components/layout/PageHeader";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import { addDays, formatDisplayDate, toDateInputValue } from "../../utils/date";
import { createReservation, getReservedSeats, getReservations } from "../../services/reservationService";
import { getUnavailableSeatsForCapacity } from "../../utils/seats";
import { getBusesByRole } from "../../services/busService";
import { getSchedules } from "../../services/scheduleService";
import Loading from "../../components/common/Loading";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";

export default function ReservationFlowPage({ role }) {
  const { user, setToast } = useAuth();
  const [searchParams] = useSearchParams();
  const [buses, setBuses] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busId, setBusId] = useState(searchParams.get("busId") || "");
  const [date, setDate] = useState(searchParams.get("date") || toDateInputValue());
  const [tripId, setTripId] = useState("");
  const [selectedSeat, setSelectedSeat] = useState("");
  const [reservedSeats, setReservedSeats] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [myReservations, setMyReservations] = useState([]);

  // Normalize buses list so each distinct bus appears once
  const uniqueBuses = useMemo(() => {
    const map = new Map();
    (buses || []).forEach((b) => {
      const key = b.busId || b.id;
      if (!map.has(key)) {
        map.set(key, {
          ...b,
          id: key,
          busId: key,
          name: b.name || b.busName,
          type: b.type || b.category || b.busCategory,
          capacity: b.capacity || 40,
        });
      }
    });
    return Array.from(map.values());
  }, [buses]);

  const selectedBus = uniqueBuses.find((b) => b.id === busId || b.busId === busId) || uniqueBuses[0];
  const currentBusId = selectedBus?.id || selectedBus?.busId || busId;
  const trips = useMemo(() => {
    return allTrips.filter((trip) => trip.busId === currentBusId || trip.busId === busId || trip.id === busId);
  }, [allTrips, currentBusId, busId]);

  const selectedTrip = trips.find((trip) => trip.id === tripId) || trips[0];
  const unavailableSeats = useMemo(
    () => getUnavailableSeatsForCapacity(selectedBus?.capacity || 40),
    [selectedBus?.capacity]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getBusesByRole(role, date),
      getSchedules(date),
      getReservations(user.id),
    ]).then(([busData, tripData, reservationsData]) => {
      if (!active) return;
      const rawBuses = busData || [];
      const validTrips = tripData || [];

      setBuses(rawBuses);
      setAllTrips(validTrips);
      setMyReservations((reservationsData || []).filter((r) => r.status !== "Cancelled"));

      // Set initial busId and tripId
      const targetParam = searchParams.get("busId");
      if (targetParam) {
        const foundTrip = validTrips.find((t) => t.id === targetParam || t.busId === targetParam);
        if (foundTrip) {
          setBusId(foundTrip.busId);
          setTripId(foundTrip.id);
        } else {
          setBusId(targetParam);
        }
      } else if (rawBuses[0]) {
        const firstId = rawBuses[0].busId || rawBuses[0].id;
        setBusId(firstId);
      }

      setError("");
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [role, date, user.id]);

  useEffect(() => {
    if (selectedTrip?.id && tripId !== selectedTrip.id) {
      setTripId(selectedTrip.id);
    }
  }, [selectedTrip?.id, tripId]);

  useEffect(() => {
    const activeTripId = selectedTrip?.id;
    if (!activeTripId || !date) return;

    getReservedSeats(activeTripId, date).then((seats) => {
      const list = Array.isArray(seats) ? seats : [];
      setReservedSeats(list);
      if (list.includes(selectedSeat) || unavailableSeats.includes(selectedSeat)) {
        setSelectedSeat("");
      }
    }).catch(() => {
      setReservedSeats([]);
    });
  }, [date, selectedTrip?.id, unavailableSeats]);

  if (loading) return <DashboardLayout><Loading label="Loading available trips" /></DashboardLayout>;

  if (error && !uniqueBuses.length) return <DashboardLayout><ErrorState title="Reservation service unavailable" message={error} /></DashboardLayout>;

  if (!selectedBus) return <DashboardLayout><EmptyState title="No scheduled buses for this date" message="Choose another date or check back after Transport Admin publishes an eligible schedule." /></DashboardLayout>;

  const existingBooking = selectedTrip ? myReservations.find(r => r.tripId === selectedTrip.id && r.date === date) : null;

  async function handleConfirm() {
    setError("");

    const targetTrip = selectedTrip || trips[0];
    if (!targetTrip || !selectedSeat) {
      setError("Select a trip and an available seat before confirming.");
      return;
    }

    setConfirming(true);
    try {
      const nextResult = await createReservation({
        user,
        role,
        tripId: targetTrip.id,
        date,
        seatNumber: selectedSeat,
      });
      setResult(nextResult);
      setToast({ type: "success", message: "Reservation successful. Your digital ticket is ready." });
    } catch (reservationError) {
      setError(reservationError.message);
      setToast({ type: "error", message: reservationError.message });
    } finally {
      setConfirming(false);
    }
  }

  if (result) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <PageHeader
            eyebrow="Reservation Confirmed"
            title="Reservation Successful \u{1F389}"
            description="Your seat is confirmed and a digital ticket has been generated."
          />
          <section className="rounded-xl border-t-4 border-emerald-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold text-safar-gray">Booking ID</dt><dd className="mt-1 break-all text-safar-ink">{result.reservation.bookingId}</dd></div>
              <div><dt className="font-semibold text-safar-gray">Ticket ID</dt><dd className="mt-1 break-all text-safar-ink">{result.ticket.ticketId}</dd></div>
              <div><dt className="font-semibold text-safar-gray">Bus</dt><dd className="mt-1 text-safar-ink">{result.reservation.busName}</dd></div>
              <div><dt className="font-semibold text-safar-gray">Seat</dt><dd className="mt-1 text-safar-ink">{result.reservation.seatNumber}</dd></div>
            </dl>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Link
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-safar-teal px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-safar-navy"
                to={`/${role}/tickets/${result.ticket.ticketId}`}
              >
                <Ticket className="h-4 w-4" />
                View Ticket
              </Link>
              <Link
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-safar-ink shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
                to={`/${role}/available-buses?tab=reservations`}
              >
                Reservation History
              </Link>
            </div>
          </section>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Seat Reservation"
          title="Reserve a seat"
          description="Select the exact bus trip, date, departure time, and seat before confirming."
        />

        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-3 md:grid-cols-3">
            <Select
              label="Select Bus"
              value={currentBusId}
              onChange={(event) => {
                setBusId(event.target.value);
                setSelectedSeat("");
              }}
            >
              {uniqueBuses.map((bus) => (
                <option key={bus.id} value={bus.id}>{bus.name} / {bus.type}</option>
              ))}
            </Select>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-safar-ink">Select Date</span>
              <input
                className="focus-ring h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-safar-ink"
                type="date"
                min={toDateInputValue()}
                max={addDays(7)}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setSelectedSeat("");
                }}
              />
            </label>
            <Select
              label="Select Departure Time"
              value={selectedTrip?.id || ""}
              onChange={(event) => {
                setTripId(event.target.value);
                setSelectedSeat("");
              }}
            >
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.departureTime} - {trip.arrivalTime} / {trip.route}
                </option>
              ))}
            </Select>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          {existingBooking ? (
            <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 p-8 text-center ring-1 ring-slate-200">
              <div className="mb-4 rounded-full bg-safar-teal/10 p-4">
                <Ticket className="h-10 w-10 text-safar-teal" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-safar-ink">You have already booked a ticket for this departure.</h3>
              <p className="mb-6 max-w-sm text-sm text-safar-gray">
                Students are limited to one ticket per departure to ensure fair access.
              </p>
              <Link
                to={`/${role}/tickets/${existingBooking.ticketId}`}
                className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-safar-teal px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-safar-navy"
              >
                View Ticket & Invoice
              </Link>
            </div>
          ) : (
            <SeatMap
              selectedSeat={selectedSeat}
              reservedSeats={reservedSeats}
              unavailableSeats={unavailableSeats}
              onSelectSeat={setSelectedSeat}
            />
          )}

          <div className="rounded-xl border-t-4 border-safar-teal bg-white p-5 shadow-sm ring-1 ring-slate-200 xl:sticky xl:top-24 xl:self-start">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-safar-ink">Reservation Summary</h2>
              <Badge tone={selectedSeat ? "success" : "warning"}>{selectedSeat || "No seat"}</Badge>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div><dt className="font-semibold text-safar-gray">Passenger</dt><dd className="mt-1 text-safar-ink">{user.name}</dd></div>
              <div><dt className="font-semibold text-safar-gray">University ID</dt><dd className="mt-1 text-safar-ink">{user.universityId || user.id}</dd></div>
              <div><dt className="font-semibold text-safar-gray">Bus</dt><dd className="mt-1 text-safar-ink">{selectedTrip?.busName}</dd></div>
              <div><dt className="font-semibold text-safar-gray">Bus Category</dt><dd className="mt-1 text-safar-ink">{selectedTrip?.busCategory}</dd></div>
              <div><dt className="font-semibold text-safar-gray">Route</dt><dd className="mt-1 text-safar-ink">{selectedTrip?.route}</dd></div>
              <div><dt className="font-semibold text-safar-gray">Date</dt><dd className="mt-1 text-safar-ink">{formatDisplayDate(date)}</dd></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-safar-teal" />{selectedTrip?.departureTime}</div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-safar-teal" />{selectedTrip?.arrivalTime}</div>
              </div>
            </dl>
            {error && (
              <div className="mt-4 flex gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                <XCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Link
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-safar-ink shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
                to={`/${role}/available-buses`}
              >
                Cancel
              </Link>
              <Button loading={confirming} disabled={!selectedSeat || !!existingBooking} onClick={handleConfirm}>
                Confirm Reservation
              </Button>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
