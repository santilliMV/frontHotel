// Ciudades principales de Colombia
export const COLOMBIA_CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena',
  'Cúcuta', 'Bucaramanga', 'Pereira', 'Santa Marta', 'Ibagué',
  'Pasto', 'Manizales', 'Neiva', 'Villavicencio', 'Armenia',
  'Valledupar', 'Montería', 'Sincelejo', 'Popayán', 'Floridablanca',
  'Soacha', 'Bello', 'Itagüí', 'Barrancabermeja', 'Soledad',
  'Palmira', 'Buenaventura', 'Tunja', 'Florencia', 'Riohacha',
  'Quibdó', 'Mocoa', 'Leticia', 'Puerto Carreño', 'Inírida',
  'San José del Guaviare', 'Mitú', 'Yopal', 'Arauca', 'San Andrés',
  'Otra',
];

// Países más comunes primero, luego resto del mundo
export const COUNTRIES = [
  'Colombia',
  'Venezuela', 'Ecuador', 'Perú', 'Bolivia', 'Chile', 'Argentina',
  'Brasil', 'Uruguay', 'Paraguay',
  'México', 'Panamá', 'Costa Rica', 'Guatemala', 'Honduras',
  'El Salvador', 'Nicaragua', 'Cuba', 'República Dominicana',
  'Estados Unidos', 'Canadá',
  'España', 'Francia', 'Alemania', 'Italia', 'Reino Unido',
  'Portugal', 'Países Bajos', 'Bélgica', 'Suiza',
  'China', 'Japón', 'Corea del Sur', 'India',
  'Otro',
];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH:          'Efectivo',
  CARD:          'Tarjeta',
  TRANSFER:      'Transferencia',
  QR:            'QR',
  NEQUI_SALOMON: 'Nequi Salomón',
  NEQUI_BRAYAN:  'Nequi Brayan',
};

export const DOC_TYPES = [
  { value: 'CC',        label: 'Cédula de ciudadanía (CC)' },
  { value: 'TI',        label: 'Tarjeta de identidad (TI)' },
  { value: 'CE',        label: 'Cédula de extranjería (CE)' },
  { value: 'RC',        label: 'Registro civil (RC)' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
] as const;

export const DOC_TYPES_SHORT = [
  { value: 'CC',        label: 'CC' },
  { value: 'TI',        label: 'TI' },
  { value: 'CE',        label: 'CE' },
  { value: 'RC',        label: 'RC' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'CASH',          label: 'Efectivo' },
  { value: 'CARD',          label: 'Tarjeta' },
  { value: 'TRANSFER',      label: 'Transferencia' },
  { value: 'QR',            label: 'QR' },
  { value: 'NEQUI_SALOMON', label: 'Nequi Salomón' },
  { value: 'NEQUI_BRAYAN',  label: 'Nequi Brayan' },
] as const;