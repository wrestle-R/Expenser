"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useStealthMode } from "@/context/StealthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  List,
  Grid2x2,
  Grid3x3,
  CalendarDays,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isAfter,
} from "date-fns";

const TODAY = new Date();

interface Transaction {
  _id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  paymentMethod: "bank" | "cash" | "splitwise";
  splitAmount?: number;
  date: string;
}

const EVENT_COLORS = {
  income: "bg-emerald-600 text-white",
  expense: "bg-red-600 text-white",
};

const EVENT_DOT_COLORS = {
  income: "bg-emerald-500",
  expense: "bg-red-500",
};

export default function CalendarPage() {
  const { isStealthMode } = useStealthMode();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(TODAY));
  const [selectedDate, setSelectedDate] = useState<Date>(TODAY);
  const [view, setView] = useState<"month" | "list" | "2col" | "week">("2col");

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const res = await fetch("/api/transactions");
        if (res.ok) {
          const data = await res.json();
          setTransactions(data.transactions);
        }
      } catch (error) {
        console.error("[Calendar] Failed to load transactions:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();
  }, []);

  const numberClassName = cn(
    "transition-all duration-200",
    isStealthMode && "blur-sm select-none"
  );

  // Group events by date string
  const eventsByDate = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    transactions.forEach((event) => {
      const dateKey = format(new Date(event.date), "yyyy-MM-dd");
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(event);
    });
    return map;
  }, [transactions]);

  // Generate calendar days for the month grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const navigateMonth = (direction: "next" | "prev") => {
    setCurrentMonth((prev) => {
      const nextMonth = direction === "next" ? addMonths(prev, 1) : subMonths(prev, 1);
      // Disable going to future months
      if (direction === "next" && isAfter(startOfMonth(nextMonth), startOfMonth(TODAY))) {
        return prev;
      }
      return nextMonth;
    });
  };

  const isNextDisabled = isSameMonth(currentMonth, TODAY) || isAfter(currentMonth, TODAY);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const rangeLabel = `${format(monthStart, "MMM d, yyyy")} - ${format(monthEnd, "MMM d, yyyy")}`;

  const MAX_VISIBLE_EVENTS = 3;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {format(currentMonth, "MMMM yyyy")}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Month Navigation */}
          <div className="flex items-center gap-1 border rounded-lg px-1 py-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-1 hidden lg:inline">
              {rangeLabel}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => navigateMonth("next")}
              disabled={isNextDisabled}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* View Switcher */}
          <div className="flex items-center border rounded-lg p-0.5">
            <Tooltip>
              <TooltipTrigger render={
                <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("list")}>
                  <List className="h-4 w-4" />
                </Button>
              } />
              <TooltipContent>List View</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={
                <Button variant={view === "2col" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("2col")}>
                  <Grid2x2 className="h-4 w-4" />
                </Button>
              } />
              <TooltipContent>2-Column View</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={
                <Button variant={view === "month" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("month")}>
                  <Grid3x3 className="h-4 w-4" />
                </Button>
              } />
              <TooltipContent>Month View</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={
                <Button variant={view === "week" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("week")}>
                  <CalendarDays className="h-4 w-4" />
                </Button>
              } />
              <TooltipContent>Week View</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-muted-foreground animate-pulse">Loading events...</div>
            </div>
          </CardContent>
        </Card>
      ) : view === "month" ? (
        <MonthView
          calendarDays={calendarDays}
          currentMonth={currentMonth}
          eventsByDate={eventsByDate}
          today={TODAY}
          maxVisible={MAX_VISIBLE_EVENTS}
          numberClassName={numberClassName}
        />
      ) : view === "week" ? (
        <WeekView
          today={TODAY}
          currentMonth={currentMonth}
          eventsByDate={eventsByDate}
          numberClassName={numberClassName}
        />
      ) : view === "list" ? (
        <ListView
          transactions={transactions}
          currentMonth={currentMonth}
          numberClassName={numberClassName}
        />
      ) : (
        <TwoColumnView
          calendarDays={calendarDays}
          currentMonth={currentMonth}
          eventsByDate={eventsByDate}
          today={TODAY}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          numberClassName={numberClassName}
        />
      )}
    </div>
  );
}

/* ======================== MONTH VIEW ======================== */
interface MonthViewProps {
  calendarDays: Date[];
  currentMonth: Date;
  eventsByDate: Record<string, Transaction[]>;
  today: Date;
  maxVisible: number;
  numberClassName: string;
}
function MonthView({ calendarDays, currentMonth, eventsByDate, today, maxVisible, numberClassName }: MonthViewProps) {
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-3">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day: Date, idx: number) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate[dateKey] || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isSameDay(day, today);
          const hasOverflow = dayEvents.length > maxVisible;

          return (
            <div
              key={idx}
              className={`min-h-[80px] sm:min-h-[140px] border-b border-r p-1.5 sm:p-2 transition-colors ${
                !isCurrentMonth ? "bg-muted/20 text-muted-foreground/50" : "hover:bg-accent/30"
              }`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-sm font-medium inline-flex items-center justify-center ${
                    isCurrentDay
                      ? "bg-primary text-primary-foreground rounded-full w-7 h-7"
                      : ""
                  }`}
                >
                  {format(day, "d")}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, maxVisible).map((event: Transaction) => (
                  <Tooltip key={event._id}>
                    <TooltipTrigger render={
                      <div
                        className={`text-[11px] sm:text-xs px-1.5 py-0.5 rounded truncate cursor-default group relative flex justify-between items-center ${
                          EVENT_COLORS[event.type as keyof typeof EVENT_COLORS] || "bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className="truncate mr-1 font-medium">{event.description}</span>
                        <span className={cn("shrink-0", numberClassName)}>₹{event.amount}</span>
                      </div>
                    } />
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-medium">{event.description}</p>
                        <p className="text-xs opacity-80">
                          {format(new Date(event.date), "PPP")}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize border-white/30 text-white"
                        >
                          {event.category}
                        </Badge>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {hasOverflow && (
                  <Tooltip>
                    <TooltipTrigger render={
                      <div className="text-[11px] text-muted-foreground cursor-default hover:text-foreground transition-colors px-1 mt-1">
                        {dayEvents.length - maxVisible} more...
                      </div>
                    } />
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-1">
                        {dayEvents.slice(maxVisible).map((event: Transaction) => (
                          <div key={event._id} className="text-xs flex justify-between gap-4">
                            <span className="font-medium truncate">{event.description}</span>
                            <span className={numberClassName}>₹{event.amount}</span>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ======================== WEEK VIEW ======================== */
interface WeekViewProps {
  currentMonth: Date;
  eventsByDate: Record<string, Transaction[]>;
  numberClassName: string;
  today?: Date;
}
function WeekView({ currentMonth, eventsByDate, numberClassName, today = new Date() }: WeekViewProps) {
  const weekStart = startOfWeek(currentMonth, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <div className="divide-y">
        {weekDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate[dateKey] || [];
          const isCurrentDay = isSameDay(day, today);

          return (
            <div
              key={dateKey}
              className={`flex flex-col sm:flex-row ${
                isCurrentDay ? "bg-accent/20" : ""
              }`}
            >
              <div
                className={`px-4 py-3 border-b sm:border-b-0 sm:border-r sm:w-28 shrink-0 text-center ${
                  isCurrentDay ? "bg-primary/10" : "bg-muted/30"
                }`}
              >
                <div className="text-xs text-muted-foreground">
                  {format(day, "EEE")}
                </div>
                <div
                  className={`text-lg font-bold ${
                    isCurrentDay
                      ? "bg-primary text-primary-foreground rounded-full w-8 h-8 inline-flex items-center justify-center mx-auto"
                      : ""
                  }`}
                >
                  {format(day, "d")}
                </div>
              </div>

              <div className="flex-1 p-3 space-y-2">
                {dayEvents.map((event: Transaction) => (
                  <Tooltip key={event._id}>
                    <TooltipTrigger render={
                      <div
                        className={`text-xs px-2 py-1.5 rounded cursor-default group relative flex justify-between ${
                          EVENT_COLORS[event.type as keyof typeof EVENT_COLORS] ||
                          "bg-muted text-muted-foreground"
                        }`}
                      >
                        <div className="font-medium truncate">
                          {event.description}
                        </div>
                        <div className={cn("font-semibold", numberClassName)}>
                           ₹{event.amount}
                        </div>
                      </div>
                    } />
                    <TooltipContent>
                      <div>
                        <p className="font-medium">{event.description}</p>
                        <p className="text-xs opacity-80">
                          {format(new Date(event.date), "PPP")}
                        </p>
                        <p className="text-xs opacity-80 capitalize">
                          {event.category} • {event.type}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {dayEvents.length === 0 && (
                  <p className="text-xs text-muted-foreground/50 text-center py-4">
                    No transactions
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ======================== LIST VIEW ======================== */
interface ListViewProps {
  transactions: Transaction[];
  currentMonth: Date;
  numberClassName: string;
}
function ListView({ transactions, currentMonth, numberClassName }: ListViewProps) {
  const monthEvents = transactions.filter((e: Transaction) => isSameMonth(new Date(e.date), currentMonth));

  const grouped = monthEvents.reduce((acc: Record<string, Transaction[]>, event: Transaction) => {
    const dateKey = format(new Date(event.date), "yyyy-MM-dd");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort().reverse(); // newest first

  if (sortedDates.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No transactions this month</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sortedDates.map((dateKey) => (
        <Card key={dateKey}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
              {isSameDay(new Date(dateKey), TODAY) && (
                <Badge variant="secondary" className="ml-2 text-xs">Today</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {grouped[dateKey].map((event: Transaction) => (
              <div
                key={event._id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/30 transition-colors"
              >
                <div className={`w-1.5 h-10 rounded-full ${EVENT_DOT_COLORS[event.type as keyof typeof EVENT_DOT_COLORS]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{event.description}</span>
                    <Badge variant="secondary" className="capitalize text-[10px]">
                      {event.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground capitalize">{event.paymentMethod}</p>
                </div>
                <div className="text-right">
                  <p className={cn(`font-semibold flex items-center justify-end ${
                    event.type === 'income' ? 'text-emerald-500' : 'text-red-500'
                  }`, numberClassName)}>
                     {event.type === "income" ? "+" : "-"}₹{event.amount.toLocaleString("en-IN")}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(event.date), "h:mm a")}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ======================== TWO COLUMN VIEW ======================== */
interface TwoColumnViewProps {
  calendarDays: Date[];
  currentMonth: Date;
  eventsByDate: Record<string, Transaction[]>;
  today: Date;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  numberClassName: string;
}
function TwoColumnView({ 
  calendarDays, 
  currentMonth, 
  eventsByDate, 
  today, 
  selectedDate, 
  setSelectedDate, 
  numberClassName 
}: TwoColumnViewProps) {
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const selectedDayEvents = (eventsByDate[selectedDateStr] || [])
    .sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Mini Calendar */}
      <div className="lg:col-span-2">
        <div className="border rounded-xl overflow-hidden bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-3">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day: Date, idx: number) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDate[dateKey] || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isCurrentDay = isSameDay(day, today);
              const isSelectedDay = isSameDay(day, selectedDate);

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-[60px] sm:min-h-[100px] border-b border-r p-2 transition-colors cursor-pointer ${
                    !isCurrentMonth ? "bg-muted/20 text-muted-foreground/50" : "hover:bg-accent/50"
                  } ${isSelectedDay ? "ring-2 ring-primary ring-inset bg-primary/5" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-medium inline-flex items-center justify-center ${
                        isCurrentDay
                          ? "bg-primary text-primary-foreground rounded-full w-7 h-7"
                          : isSelectedDay
                          ? "bg-primary/20 text-primary rounded-full w-7 h-7"
                          : ""
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {dayEvents.slice(0, 10).map((event: Transaction, i: number) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${EVENT_DOT_COLORS[event.type as keyof typeof EVENT_DOT_COLORS]}`}
                        title={event.description}
                      />
                    ))}
                    {dayEvents.length > 10 && (
                      <div className="w-2 h-2 rounded-full bg-muted-foreground" title={`${dayEvents.length - 10} more`} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Events List Sidebar */}
      <div>
        <Card className="h-full">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{isSameDay(selectedDate, today) ? "Transactions Today" : format(selectedDate, "MMM d, yyyy")}</span>
              <Badge variant="secondary" className="text-xs">
                {selectedDayEvents.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[600px] overflow-y-auto">
            {selectedDayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Info className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No transactions on this date</p>
              </div>
            ) : (
              <div className="divide-y">
                {selectedDayEvents.map((event: Transaction) => (
                  <div
                    key={event._id}
                    className="flex items-center gap-3 p-4 hover:bg-accent/30 transition-colors"
                  >
                    <div className={`w-1 h-10 rounded-full shrink-0 ${EVENT_DOT_COLORS[event.type as keyof typeof EVENT_DOT_COLORS]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{event.description}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {event.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center">
                          {format(new Date(event.date), "h:mm a")}
                        </span>
                      </div>
                    </div>
                    <div className={cn(`text-right font-medium text-sm ${
                      event.type === 'income' ? 'text-emerald-500' : 'text-red-500'
                    }`, numberClassName)}>
                      {event.type === "income" ? "+" : "-"}₹{event.amount.toLocaleString("en-IN")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
