"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getUsers, updateUserRole, createUserAction, deleteUserAction } from '@/app/actions/team';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Shield, Crown, UserCog, Users, UserPlus, Trash2, Loader2, Mail } from 'lucide-react';
import type { Role } from '@prisma/client';
import { useLanguage } from '@/components/language-provider';

// ─── Translations ──────────────────────────────────────────
const translations = {
  pt: {
    title: "Membros da Equipe",
    description: "Gerencie quem tem acesso ao ERP e defina suas funções administrativas e operacionais.",
    addMember: "Convidar Membro",
    refresh: "Atualizar",
    name: "Nome",
    email: "E-mail",
    role: "Função",
    actions: "Ações",
    newMemberTitle: "Novo Membro",
    newMemberDesc: "Insira os dados do novo membro para liberar o acesso ao sistema. A senha inicial padrão será 'Aurelius123!'.",
    save: "Cadastrar",
    cancel: "Cancelar",
    creating: "Cadastrando...",
    successAdd: "Membro adicionado com sucesso!",
    errorAdd: "Erro ao adicionar membro.",
    successDelete: "Membro removido com sucesso!",
    errorDelete: "Erro ao remover membro.",
    successRole: "Função do usuário atualizada com sucesso!",
    errorRole: "Erro ao atualizar função.",
    empty: "Nenhum membro encontrado neste tenant.",
    admin: "Administrador",
    operator: "Operador",
    auditor: "Auditor",
    sovereign: "Proprietário",
    deleteConfirm: "Tem certeza que deseja remover este membro da equipe?"
  },
  es: {
    title: "Miembros del Equipo",
    description: "Gestione quién tiene acceso al ERP y defina sus funciones administrativas y operativas.",
    addMember: "Invitar Miembro",
    refresh: "Actualizar",
    name: "Nombre",
    email: "Correo electrónico",
    role: "Función",
    actions: "Acciones",
    newMemberTitle: "Nuevo Miembro",
    newMemberDesc: "Ingrese los datos del nuevo miembro para habilitar su acceso. La contraseña inicial por defecto será 'Aurelius123!'.",
    save: "Registrar",
    cancel: "Cancelar",
    creating: "Registrando...",
    successAdd: "¡Miembro agregado con éxito!",
    errorAdd: "Error al agregar miembro.",
    successDelete: "¡Miembro eliminado con éxito!",
    errorDelete: "Error al eliminar miembro.",
    successRole: "¡Función de usuario actualizada con éxito!",
    errorRole: "Error al actualizar la función.",
    empty: "Ningún miembro encontrado en este tenant.",
    admin: "Administrador",
    operator: "Operador",
    auditor: "Auditor",
    sovereign: "Propietario",
    deleteConfirm: "¿Está seguro que desea eliminar a este miembro del equipo?"
  }
};

interface UserWithPermissions {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
}

export default function TeamSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.tenantId as string;
  const { language } = useLanguage();
  const currentLang = (language === 'es' || language === 'pt') ? language : 'pt';
  const t = translations[currentLang];

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [savingMember, setSavingMember] = useState(false);

  // Form State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("OPERATOR");

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const usersData = await getUsers(tenantId);
      setUsers(usersData);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar equipe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update role handler
  const handleRoleChange = async (userId: string, targetRole: Role) => {
    try {
      await updateUserRole(userId, targetRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: targetRole } : u));
      toast.success(t.successRole);
    } catch (error: any) {
      toast.error(error.message || t.errorRole);
    }
  };

  // Delete user handler
  const handleDeleteUser = async (userId: string) => {
    const confirm = window.confirm(t.deleteConfirm);
    if (!confirm) return;

    try {
      await deleteUserAction(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success(t.successDelete);
    } catch (error: any) {
      toast.error(error.message || t.errorDelete);
    }
  };

  // Create user handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    setSavingMember(true);
    try {
      const res = await createUserAction({
        name: newName,
        email: newEmail,
        role: newRole,
      });
      if (res.success) {
        toast.success(t.successAdd);
        setNewName("");
        setNewEmail("");
        setNewRole("OPERATOR");
        setOpenDialog(false);
        loadData();
      }
    } catch (error: any) {
      toast.error(error.message || t.errorAdd);
    } finally {
      setSavingMember(false);
    }
  };

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case 'SOVEREIGN': return <Crown className="w-3.5 h-3.5 text-amber-500" />;
      case 'ADMIN': return <UserCog className="w-3.5 h-3.5 text-primary" />;
      case 'OPERATOR': return <Users className="w-3.5 h-3.5 text-blue-500" />;
      case 'AUDITOR': return <Shield className="w-3.5 h-3.5 text-purple-500" />;
    }
  };

  const getRoleBadgeLabel = (role: Role) => {
    if (role === 'SOVEREIGN') return t.sovereign;
    if (role === 'ADMIN') return t.admin;
    if (role === 'OPERATOR') return t.operator;
    if (role === 'AUDITOR') return t.auditor;
    return role;
  };

  const getRoleBadgeClass = (role: Role) => {
    switch (role) {
      case 'SOVEREIGN': return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'ADMIN': return 'border-primary/30 bg-primary/10 text-primary';
      case 'OPERATOR': return 'border-blue-500/30 bg-blue-500/10 text-blue-500';
      case 'AUDITOR': return 'border-purple-500/30 bg-purple-500/10 text-purple-500';
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            {t.description}
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Add member dialog */}
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <button className="axis-btn-primary min-h-[44px] md:h-[36px] px-5 flex items-center justify-center gap-2 text-[14px] font-bold shadow-md cursor-pointer">
                <UserPlus className="w-4 h-4" />
                {t.addMember}
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[50vw] w-[95vw] glass-pop-up p-0 overflow-hidden">
              <DialogHeader className="text-left p-6 border-b border-border bg-muted/30">
                <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  {t.newMemberTitle}
                </DialogTitle>
                <DialogDescription className="text-[12px] text-muted-foreground font-medium">
                  {t.newMemberDesc}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateUser} className="p-6 flex flex-col gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.name}</Label>
                  <Input
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: João Silva"
                    className="bg-background border-border text-[13px] min-h-[44px] md:h-[40px] rounded-[8px] font-medium shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.email}</Label>
                  <Input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Ex: joao@fazenda.com"
                    className="bg-background border-border text-[13px] min-h-[44px] md:h-[40px] rounded-[8px] font-medium shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.role}</Label>
                  <Select value={newRole} onValueChange={(val) => setNewRole(val as Role)}>
                    <SelectTrigger className="bg-background border-border text-[13px] min-h-[44px] md:h-[40px] rounded-[8px]">
                      <SelectValue placeholder="Selecione a função" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-popover-foreground">
                      <SelectItem value="ADMIN" className="text-[12px]">{t.admin}</SelectItem>
                      <SelectItem value="OPERATOR" className="text-[12px]">{t.operator}</SelectItem>
                      <SelectItem value="AUDITOR" className="text-[12px]">{t.auditor}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="mt-4 pt-6 border-t border-border flex justify-end items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenDialog(false)}
                    className="px-5 min-h-[44px] rounded-[8px] text-[14px] font-bold text-muted-foreground hover:bg-muted transition-all cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={savingMember}
                    className="bg-primary text-primary-foreground px-6 min-h-[44px] rounded-[8px] hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-[14px] font-bold disabled:opacity-50 shadow-md active:scale-95 cursor-pointer"
                  >
                    {savingMember && <Loader2 className="w-4 h-4 animate-spin text-secondary" />}
                    {savingMember ? t.creating : t.save}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-border text-muted-foreground min-h-[44px] md:h-[36px] px-4 font-bold flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : t.refresh}
          </Button>
        </div>
      </div>

      {/* Desktop Members Table */}
      <div className="hidden md:block overflow-hidden border border-border/60 rounded-[12px] bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/40 hover:bg-transparent">
              <TableHead className="text-primary font-bold uppercase tracking-widest text-[11px] p-4">
                {t.name}
              </TableHead>
              <TableHead className="text-primary font-bold uppercase tracking-widest text-[11px] p-4">
                {t.email}
              </TableHead>
              <TableHead className="text-primary font-bold uppercase tracking-widest text-[11px] p-4">
                {t.role}
              </TableHead>
              <TableHead className="text-primary font-bold uppercase tracking-widest text-[11px] p-4 text-right">
                {t.actions}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/60">
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                  <span className="text-[11px] text-muted-foreground font-extrabold uppercase tracking-wider">Carregando...</span>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-20">
                  <span className="text-[11px] text-muted-foreground/80 font-bold uppercase tracking-widest">{t.empty}</span>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                        {(user.name || user.email).charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-foreground">{user.name || "Sem nome"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="p-4 text-sm font-medium text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="p-4">
                    {user.role === "SOVEREIGN" ? (
                      <Badge variant="outline" className={`gap-1 font-semibold ${getRoleBadgeClass(user.role)}`}>
                        {getRoleIcon(user.role)}
                        {getRoleBadgeLabel(user.role)}
                      </Badge>
                    ) : (
                      <Select 
                        value={user.role} 
                        onValueChange={(val) => handleRoleChange(user.id, val as Role)}
                      >
                        <SelectTrigger className="w-[180px] bg-background border-border h-[34px] rounded-[6px] text-xs font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border text-popover-foreground">
                          <SelectItem value="ADMIN" className="text-[12px]">{t.admin}</SelectItem>
                          <SelectItem value="OPERATOR" className="text-[12px]">{t.operator}</SelectItem>
                          <SelectItem value="AUDITOR" className="text-[12px]">{t.auditor}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="p-4 text-right">
                    {user.role !== "SOVEREIGN" && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md transition-all inline-flex items-center justify-center cursor-pointer"
                        title={t.actions.replace("Ações", "Excluir")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Members List */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {loading ? (
          <div className="border border-border/60 rounded-[12px] p-20 text-center bg-card">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <span className="text-[11px] text-muted-foreground font-extrabold uppercase tracking-wider">Carregando...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="border border-border/60 rounded-[12px] p-20 text-center bg-card">
            <span className="text-[11px] text-muted-foreground/80 font-bold uppercase tracking-widest">{t.empty}</span>
          </div>
        ) : (
          users.map((user) => (
            <div 
              key={user.id} 
              className="border border-border/80 rounded-[12px] bg-card/65 backdrop-blur-md p-5 shadow-sm space-y-4 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-foreground">{user.name || "Sem nome"}</h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3 text-muted-foreground" />
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Role Actions */}
              <div className="pt-3 border-t border-border/30 flex items-center justify-between">
                <div>
                  {user.role === "SOVEREIGN" ? (
                    <Badge variant="outline" className={`gap-1 font-semibold ${getRoleBadgeClass(user.role)}`}>
                      {getRoleIcon(user.role)}
                      {getRoleBadgeLabel(user.role)}
                    </Badge>
                  ) : (
                    <Select 
                      value={user.role} 
                      onValueChange={(val) => handleRoleChange(user.id, val as Role)}
                    >
                      <SelectTrigger className="w-[140px] bg-background border-border h-[36px] rounded-[6px] text-xs font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-popover-foreground">
                        <SelectItem value="ADMIN" className="text-[12px]">{t.admin}</SelectItem>
                        <SelectItem value="OPERATOR" className="text-[12px]">{t.operator}</SelectItem>
                        <SelectItem value="AUDITOR" className="text-[12px]">{t.auditor}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  {user.role !== "SOVEREIGN" && (
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="min-h-[44px] px-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md transition-all inline-flex items-center justify-center gap-1 font-bold text-[12px] border border-rose-200 dark:border-rose-900 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{t.actions.replace("Ações", "Excluir")}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
