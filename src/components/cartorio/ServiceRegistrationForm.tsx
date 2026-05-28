"use client";

import React, { useState } from "react";
import { PlusCircle, FileText, Upload, Sparkles, AlertTriangle } from "lucide-react";

export default function ServiceRegistrationForm({ module }: { module: "RCPN" | "NOTAS" }) {
  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    whatsapp: "",
    serviceType: "",
    ansataProtocol: "",
    seloEletronico: "",
  });

  const [status, setStatus] = useState("EM_ANALISE"); // EM_ANALISE, EM_ANDAMENTO, NOTA_DEVOLUTIVA, CONCLUIDO
  const [notaDevolutivaDeadline, setNotaDevolutivaDeadline] = useState("");
  const [notaDevolutivaReason, setNotaDevolutivaReason] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (newStatus === "CONCLUIDO") {
      if (!formData.ansataProtocol && !formData.seloEletronico) {
        alert("Para concluir o serviço, é obrigatório informar o Protocolo Ansata ou o Selo Eletrônico.");
        return;
      }
    }
    
    if (newStatus === "NOTA_DEVOLUTIVA") {
      // Cálculo automático de 10 dias úteis (simplificado para demonstração)
      const date = new Date();
      let daysAdded = 0;
      while (daysAdded < 10) {
        date.setDate(date.getDate() + 1);
        if (date.getDay() !== 0 && date.getDay() !== 6) { // Ignora fds
          daysAdded++;
        }
      }
      setNotaDevolutivaDeadline(date.toISOString().split('T')[0]);
    } else {
      setNotaDevolutivaDeadline("");
    }
    
    setStatus(newStatus);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-4xl mx-auto mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">
          Novo Serviço - {module === "RCPN" ? "Registro Civil" : "Tabelionato de Notas"}
        </h2>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          status === "CONCLUIDO" ? "bg-green-100 text-green-700" :
          status === "NOTA_DEVOLUTIVA" ? "bg-red-100 text-red-700" :
          "bg-blue-100 text-blue-700"
        }`}>
          {status.replace("_", " ")}
        </span>
      </div>

      <form className="space-y-6">
        {/* Dados do Solicitante */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <h3 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">1</span>
            Dados do Solicitante (Obrigatório)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Nome Completo</label>
              <input type="text" name="nome" required value={formData.nome} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border" placeholder="João da Silva" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">CPF</label>
              <input type="text" name="cpf" required value={formData.cpf} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border" placeholder="000.000.000-00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">WhatsApp</label>
              <input type="tel" name="whatsapp" required value={formData.whatsapp} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border" placeholder="(00) 00000-0000" />
            </div>
          </div>
        </div>

        {/* Detalhes do Serviço */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <h3 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">2</span>
            Detalhes do Serviço
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Tipo de Ato</label>
              <select name="serviceType" value={formData.serviceType} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border">
                <option value="">Selecione...</option>
                {module === "NOTAS" ? (
                  <>
                    <option value="PROCURACAO">Procuração Pública</option>
                    <option value="INVENTARIO">Inventário</option>
                    <option value="DIVORCIO">Divórcio</option>
                    <option value="ATA_NOTARIAL">Ata Notarial</option>
                  </>
                ) : (
                  <>
                    <option value="CERTIDAO">Emissão de Certidão</option>
                    <option value="RETIFICACAO">Retificação Administrativa</option>
                    <option value="CASAMENTO">Habilitação de Casamento</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Documentos Anexos</label>
              <div className="border-2 border-dashed border-gray-300 rounded-md p-2 text-center hover:bg-gray-100 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                <span className="text-sm text-gray-500">Clique para anexar RG, CNH, etc.</span>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-md border border-blue-100 flex items-start justify-between">
            <div>
              <h4 className="font-medium text-blue-800 flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-blue-600" />
                Inteligência Artificial (Gemini 3.1 Pro)
              </h4>
              <p className="text-sm text-blue-600 mt-1">Gere a minuta automaticamente baseada nos dados e documentos anexados.</p>
            </div>
            <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              Gerar Minuta
            </button>
          </div>
        </div>

        {/* Gestão e Status */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <h3 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">3</span>
            Controle e Conclusão
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Status Atual</label>
              <select value={status} onChange={handleStatusChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border">
                <option value="EM_ANALISE">Em Análise</option>
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="NOTA_DEVOLUTIVA">Nota Devolutiva</option>
                <option value="CONCLUIDO">Concluído</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Protocolo Ansata</label>
              <input type="text" name="ansataProtocol" value={formData.ansataProtocol} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border" placeholder="Opcional para andamento" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Selo Eletrônico</label>
              <input type="text" name="seloEletronico" value={formData.seloEletronico} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border" placeholder="Opcional para andamento" />
            </div>
          </div>

          {status === "NOTA_DEVOLUTIVA" && (
            <div className="bg-red-50 p-4 rounded-md border border-red-200 mt-4">
              <h4 className="font-medium text-red-800 flex items-center mb-2">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Emissão de Nota Devolutiva
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="col-span-3">
                  <label className="block text-sm font-medium text-red-700 mb-1">Motivo / Exigência</label>
                  <textarea value={notaDevolutivaReason} onChange={(e) => setNotaDevolutivaReason(e.target.value)} className="w-full border-red-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 p-2 border" rows={2} placeholder="Descreva os documentos faltantes..."></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-700 mb-1">Prazo Fatal (10d úteis)</label>
                  <input type="date" value={notaDevolutivaDeadline} readOnly className="w-full bg-red-100 text-red-800 border-red-300 rounded-md p-2 border" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button type="button" className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" className="px-4 py-2 bg-green-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-green-700">
            Salvar Registro
          </button>
        </div>
      </form>
    </div>
  );
}
