import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
console.log("ptBR imported successfully:", ptBR ? "yes" : "no");
console.log("formatted date:", format(new Date(), "dd/MM/yyyy", { locale: ptBR }));
