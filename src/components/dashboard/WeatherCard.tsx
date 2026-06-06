"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  Sun,
  CloudRain,
  Wind,
  Droplets,
  MapPin,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Loader2,
  Calendar,
} from "lucide-react";
import { useTheme } from "next-themes";

interface WeatherData {
  temp: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
  locationName: string;
}

export function WeatherCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  // Default coordinate: Alto Paraná (Paraguay agricultural region)
  const defaultLat = -25.5061;
  const defaultLon = -54.6112;

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        () => {
          // Fallback to default agricultural region if user denies
          setCoords({ lat: defaultLat, lon: defaultLon });
        }
      );
    } else {
      setCoords({ lat: defaultLat, lon: defaultLon });
    }
  }, []);

  useEffect(() => {
    if (!coords) return;
    const { lat, lon } = coords;

    async function fetchWeather() {
      setLoading(true);
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`
        );
        if (!res.ok) throw new Error("Falha ao carregar clima");
        const data = await res.json();

        // Reverse geocoding using Nominatim (OpenStreetMap)
        let locationName = lat === defaultLat ? "Alto Paraná" : "Sua Localização (GPS)";
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt,es,en`
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const addr = geoData.address;
            const cityName = addr?.city || addr?.town || addr?.village || addr?.municipality || addr?.county || addr?.state;
            if (cityName) {
              locationName = cityName;
            }
          }
        } catch (geoErr) {
          console.error("Geocoding failed, falling back to coords:", geoErr);
        }

        const current = data.current;
        setWeather({
          temp: current.temperature_2m,
          humidity: current.relative_humidity_2m,
          precipitation: current.precipitation,
          windSpeed: current.wind_speed_10m,
          weatherCode: current.weather_code,
          locationName: locationName,
        });
      } catch (err: any) {
        setError(err.message || "Erro de conexão");
      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, [coords]);

  const getWeatherIcon = (code: number) => {
    if (code >= 51 && code <= 99) return <CloudRain className="w-10 h-10 text-sky-400 animate-bounce" />;
    if (code >= 1 && code <= 3) return <Cloud className="w-10 h-10 text-slate-400" />;
    if (code === 0) return <Sun className="w-10 h-10 text-amber-400 animate-spin-slow" />;
    return <HelpCircle className="w-10 h-10 text-slate-400" />;
  };

  const getWeatherDescription = (code: number) => {
    if (code === 0) return "Céu Limpo";
    if (code >= 1 && code <= 3) return "Parcialmente Nublado";
    if (code >= 45 && code <= 48) return "Nevoeiro";
    if (code >= 51 && code <= 55) return "Chuvisco";
    if (code >= 61 && code <= 65) return "Chuva";
    if (code >= 80 && code <= 82) return "Pancadas de Chuva";
    if (code >= 95 && code <= 99) return "Tempestade";
    return "Nublado";
  };

  const getAgriculturalAdvice = (temp: number, wind: number, humidity: number, rain: number) => {
    if (rain > 0) {
      return {
        status: "critical",
        title: "Alerta de Chuva",
        message: "Suspensão de colheita e pulverização recomendada. Evite compactação do solo com maquinário pesado.",
        icon: <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />,
        bgColor: "bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 border-l-4 border-l-rose-500",
        textColor: "text-rose-900 dark:text-rose-300",
      };
    }
    if (wind > 20) {
      return {
        status: "warning",
        title: "Vento Forte Detectado",
        message: "Condição imprópria para aplicação de defensivos agrícolas devido ao alto risco de deriva. Adie a atividade.",
        icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
        bgColor: "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 border-l-4 border-l-amber-500",
        textColor: "text-amber-900 dark:text-amber-300",
      };
    }
    if (temp > 35) {
      return {
        status: "warning",
        title: "Calor Extremo",
        message: "Evite pulverizar sob sol forte e baixa umidade. O produto evapora antes de penetrar na cultura.",
        icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
        bgColor: "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 border-l-4 border-l-amber-500",
        textColor: "text-amber-900 dark:text-amber-300",
      };
    }
    return {
      status: "ideal",
      title: "Condições Ideais",
      message: "Período favorável para colheita, tratos culturais e pulverização. Aproveite as condições climáticas.",
      icon: <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      bgColor: "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 border-l-4 border-l-emerald-500",
      textColor: "text-emerald-900 dark:text-emerald-300",
    };
  };

  if (loading) {
    return (
      <div className="border border-border rounded-xl p-6 bg-card flex items-center justify-center h-[180px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground font-medium">Buscando dados climáticos (GPS)...</span>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="border border-border rounded-xl p-6 bg-card flex items-center justify-center h-[180px]">
        <AlertTriangle className="w-6 h-6 text-rose-500 mr-2" />
        <span className="text-sm text-rose-500 font-medium">Não foi possível carregar a previsão.</span>
      </div>
    );
  }

  const advice = getAgriculturalAdvice(
    weather.temp,
    weather.windSpeed,
    weather.humidity,
    weather.precipitation
  );

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl">
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Left Side: Current Temperature and Location */}
        <div className="flex items-center gap-4 md:border-r border-border/50 md:pr-4">
          {getWeatherIcon(weather.weatherCode)}
          <div>
            <div className="flex items-center text-xs text-slate-800 dark:text-slate-200 font-bold gap-1 uppercase tracking-wider mb-0.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>{weather.locationName}</span>
            </div>
            <div className="text-3xl font-extrabold tracking-tighter text-slate-900 dark:text-slate-50">
              {weather.temp.toFixed(1)}°C
            </div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mt-0.5">
              {getWeatherDescription(weather.weatherCode)}
            </div>
          </div>
        </div>

        {/* Center: Meteorological Details */}
        <div className="grid grid-cols-3 gap-4 md:border-r border-border/50 md:pr-4">
          <div className="flex flex-col items-center justify-center text-center">
            <Droplets className="w-5 h-5 text-sky-600 dark:text-sky-400 mb-1" />
            <span className="text-[10px] uppercase font-extrabold text-slate-500 dark:text-slate-400 tracking-widest">Umidade</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-slate-50 mt-0.5">{weather.humidity}%</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center">
            <Wind className="w-5 h-5 text-teal-600 dark:text-teal-400 mb-1" />
            <span className="text-[10px] uppercase font-extrabold text-slate-500 dark:text-slate-400 tracking-widest">Ventos</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-slate-50 mt-0.5">{weather.windSpeed.toFixed(0)} km/h</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center">
            <CloudRain className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-1" />
            <span className="text-[10px] uppercase font-extrabold text-slate-500 dark:text-slate-400 tracking-widest">Chuva</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-slate-50 mt-0.5">{weather.precipitation.toFixed(1)} mm</span>
          </div>
        </div>

        {/* Right Side: Agricultural Advice Card */}
        <div className={`p-4 rounded-lg ${advice.bgColor} flex gap-3 h-full items-start transition-all`}>
          {advice.icon}
          <div>
            <div className={`text-xs font-extrabold uppercase tracking-widest mb-1 ${advice.textColor}`}>{advice.title}</div>
            <p className="text-[11.5px] font-semibold leading-relaxed text-slate-800 dark:text-slate-100">{advice.message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
