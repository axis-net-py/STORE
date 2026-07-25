// Strings compartilhadas entre List/Sheet de todos os módulos (CRUD genérico).
// Módulo usa via: const c = COMMON[language]; c.active / c.actions / etc.

export const COMMON = {
  pt: {
    active: "Ativo",
    inactive: "Inativo",
    actions: "Ações",
    edit: "Editar",
    cancel: "Cancelar",
    delete: "Excluir",
    saving: "Salvando...",
    status: "Status",
    email: "E-mail",
    phone: "Telefone",
    address: "Endereço",
    city: "Cidade",
    country: "País",
    category: "Categoria",
    document: "Documento",
    name: "Nome",
    physical: "Física",
    legal: "Jurídica",
    showInactive: "Mostrar Inativos",
  },
  es: {
    active: "Activo",
    inactive: "Inactivo",
    actions: "Acciones",
    edit: "Editar",
    cancel: "Cancelar",
    delete: "Eliminar",
    saving: "Guardando...",
    status: "Estado",
    email: "Correo",
    phone: "Teléfono",
    address: "Dirección",
    city: "Ciudad",
    country: "País",
    category: "Categoría",
    document: "Documento",
    name: "Nombre",
    physical: "Física",
    legal: "Jurídica",
    showInactive: "Mostrar Inactivos",
  },
} as const

export type Lang = keyof typeof COMMON

/** Status de Appointment — usado no perfil do paciente e no painel de consulta. */
export const APPOINTMENT_STATUS_LABEL: Record<Lang, Record<string, string>> = {
  pt: {
    AGENDADA: "Agendada",
    CONFIRMADA: "Confirmada",
    CONCLUIDA: "Concluída",
    CANCELADA: "Cancelada",
    FALTOU: "Faltou",
  },
  es: {
    AGENDADA: "Agendada",
    CONFIRMADA: "Confirmada",
    CONCLUIDA: "Completada",
    CANCELADA: "Cancelada",
    FALTOU: "Ausente",
  },
}
