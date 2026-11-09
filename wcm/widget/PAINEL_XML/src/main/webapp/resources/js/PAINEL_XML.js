/*
 * ANALISTA RICARDO ANDRADE
 * 2611-P11
 */

// Auxiliares num unico objeto: o Fluig carrega o JS de todas as widgets na mesma pagina.
var painelXMLUtil = {
    LIMITE_LOTE: 20,
    ROTULO_ERP: { RM: "TOTVS RM", DATASUL: "TOTVS Datasul" },

    // Nome do emitente vem do XML de terceiros: nunca entra na pagina sem escape.
    esc: function (texto) {
        return String(texto == null ? "" : texto)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
    valor: function (linha, campo) {
        if (!linha) return "";
        if (linha[campo] != null) return linha[campo];
        return "";
    },
    dataIso: function (data) {
        var mes = ("0" + (data.getMonth() + 1)).slice(-2);
        var dia = ("0" + data.getDate()).slice(-2);
        return data.getFullYear() + "-" + mes + "-" + dia;
    },
    // "2026-11-05" -> "05/11/2026"; qualquer outro formato passa como veio.
    dataBr: function (iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
        return m ? m[3] + "/" + m[2] + "/" + m[1] : String(iso || "");
    },
    // "5100.00" -> "5.100,00"
    moeda: function (valor) {
        var n = parseFloat(String(valor || "").replace(",", "."));
        if (isNaN(n)) return String(valor || "");
        var partes = n.toFixed(2).split(".");
        return partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + partes[1];
    },
    hora: function () {
        var d = new Date();
        return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    },
    normalizarCnpj: function (valor) {
        return String(valor || "").toUpperCase().replace(/[.\/-]/g, "");
    },
    formatarCnpj: function (valor) {
        var c = painelXMLUtil.normalizarCnpj(valor);
        if (c.length !== 14) return c;
        return c.substring(0, 2) + "." + c.substring(2, 5) + "." + c.substring(5, 8) + "/" + c.substring(8, 12) + "-" + c.substring(12);
    },
    chaveCurta: function (chave) {
        var c = String(chave || "");
        return c.length > 22 ? c.substring(0, 6) + "…" + c.substring(c.length - 10) : c;
    },

    // ---------------------------------------------------------------- INTEGRACAO COM O ERP
    // Situacao do documento na operacao, uma so por linha (os cartoes somam o total):
    // CANCELADO > SEM_ERP (CNPJ sem "Enviar ao ERP") > INTEGRADO / ERRO / PENDENTE (nunca enviado).
    estadoOperacao: function (linha) {
        var U = painelXMLUtil;
        if (String(U.valor(linha, "SITUACAO")).toUpperCase() === "CANCELADO") return "CANCELADO";
        if (U.valor(linha, "ERP_LIGADO") !== "S") return "SEM_ERP";
        var st = String(U.valor(linha, "ERP")).toUpperCase();
        if (st === "INTEGRADO") return "INTEGRADO";
        if (st === "ERRO") return "ERRO";
        return "PENDENTE";
    },
    // Reenvio vale para pendente e com erro, de CNPJ com ERP ligado e documento nao cancelado.
    podeReenviar: function (linha) {
        var e = painelXMLUtil.estadoOperacao(linha);
        return e === "PENDENTE" || e === "ERRO";
    },
    rotuloErp: function (nome) {
        var n = String(nome || "").toUpperCase();
        return painelXMLUtil.ROTULO_ERP[n] || n;
    },
    selo: function (linha) {
        var U = painelXMLUtil;
        var e = U.estadoOperacao(linha);
        if (e === "SEM_ERP") return "<span class='text-muted'>—</span>";
        var cor = { INTEGRADO: "success", PENDENTE: "warning", ERRO: "danger", CANCELADO: "default" }[e];
        var texto = { INTEGRADO: "INTEGRADO", PENDENTE: "PENDENTE", ERRO: "ERRO", CANCELADO: "CANCELADO" }[e];
        var erp = U.valor(linha, "ERP_NOME");
        var msg = U.valor(linha, "ERP_MSG");
        return "<span class='label label-" + cor + "'" + (msg ? " title='" + U.esc(msg) + "'" : "") + ">" + texto + "</span>" +
            (erp && e !== "CANCELADO" ? " <small class='pxml-erp-nome'>" + U.esc(erp) + "</small>" : "");
    },

    // ---------------------------------------------------------------- DANFE / DANFSe
    // So entram com XML completo e quando o cadastro do CNPJ nao desligou o PDF.
    elegivelPdf: function (linha) {
        var U = painelXMLUtil;
        var tipo = U.valor(linha, "TIPO");
        var modo = U.valor(linha, "PDF_MODO");
        if ((tipo !== "NFE" && tipo !== "NFSE") || !modo || modo === "desligado") return false;
        return U.valor(linha, "NIVEL") === "COMPLETO";
    },
    // NFS-e municipal (chave sintética MUN-...) não tem DANFSe: o motor gera um espelho, sem validade fiscal.
    rotuloPdf: function (linha) {
        var U = painelXMLUtil;
        if (U.valor(linha, "TIPO") === "NFE") return "DANFE";
        return String(U.valor(linha, "CHAVE")).indexOf("MUN-") === 0 ? "Espelho" : "DANFSe";
    },
    // "na" = sem PDF para este documento; "gerado" = ja existe no GED; "pendente" = elegivel e ainda sem PDF.
    estadoPdf: function (linha) {
        var U = painelXMLUtil;
        if (!U.elegivelPdf(linha)) return "na";
        return U.valor(linha, "ID_GED_PDF") ? "gerado" : "pendente";
    },
    botaoPdf: function (linha) {
        var U = painelXMLUtil;
        if (!U.elegivelPdf(linha)) return "";
        var tipo = U.valor(linha, "TIPO");
        var rotulo = U.rotuloPdf(linha);
        var pronto = U.valor(linha, "ID_GED_PDF");
        var dica = rotulo === "Espelho" ? "Espelho da NFS-e municipal (sem validade fiscal; o oficial é o da prefeitura)" : rotulo;
        return " <button type='button' class='btn btn-xs " + (pronto ? "btn-success" : "btn-default") + "' data-pdf data-tipo='" + tipo + "' data-chave='" + U.esc(U.valor(linha, "CHAVE")) +
            "' title='" + U.esc(pronto ? dica + ": abrir" : "Gerar o " + dica) + "'>" + rotulo + "</button>";
    },

    // ---------------------------------------------------------------- TOTALIZADORES
    // Conta tudo que veio da consulta (os filtros do grid nao mexem nos totalizadores).
    contagens: function (dados) {
        var U = painelXMLUtil;
        var c = { total: dados.length, INTEGRADO: 0, PENDENTE: 0, ERRO: 0, CANCELADO: 0, SEM_ERP: 0,
            tipo: { NFE: 0, CTE: 0, NFSE: 0, NF3E: 0, NFCOM: 0 },
            pdf: { NFE: { gerados: 0, total: 0 }, NFSE: { gerados: 0, total: 0 } }, erps: {} };
        for (var i = 0; i < dados.length; i++) {
            var l = dados[i];
            c[U.estadoOperacao(l)]++;
            var tipo = U.valor(l, "TIPO");
            if (c.tipo[tipo] != null) c.tipo[tipo]++;
            if (U.valor(l, "ERP_LIGADO") === "S" && U.valor(l, "ERP_NOME")) c.erps[U.valor(l, "ERP_NOME")] = true;
            if (U.elegivelPdf(l)) {
                c.pdf[tipo].total++;
                if (U.valor(l, "ID_GED_PDF")) c.pdf[tipo].gerados++;
            }
        }
        return c;
    },
    // Nome do ERP quando todos os CNPJs usam o mesmo ("TOTVS RM"); senao, so "ERP".
    nomeErp: function (erps) {
        var nomes = [];
        for (var n in erps) if (erps.hasOwnProperty(n)) nomes.push(n);
        return nomes.length === 1 ? painelXMLUtil.rotuloErp(nomes[0]) : "ERP";
    },
    kpi: function (titulo, valorKpi, cor, complemento, dica, filtro, ativo) {
        var clicavel = filtro != null;
        return "<div class='pxml-kpi-card" + (clicavel ? " pxml-kpi-click" : "") + (ativo ? " pxml-kpi-ativo" : "") + "'" +
            (dica ? " title='" + dica + "'" : "") + (clicavel ? " data-kpi='" + filtro + "'" : "") +
            "><div class='pxml-kpi-body'><span class='pxml-kpi-label pxml-label-" + cor + "'>" + titulo +
            "</span><span class='pxml-kpi-num'>" + valorKpi + "</span>" +
            (complemento ? "<span class='pxml-kpi-sub'>" + complemento + "</span>" : "") +
            "</div><div class='pxml-kpi-bar pxml-bar-" + cor + "'></div></div>";
    },
    // Cartao de PDF: "gerados / total" e quantos faltam.
    kpiPdf: function (rotulo, contagem, cor) {
        var c = contagem || { gerados: 0, total: 0 };
        var faltam = c.total - c.gerados;
        return painelXMLUtil.kpi(rotulo, c.gerados + " / " + c.total, cor,
            c.total === 0 ? "sem XML completo" : (faltam === 0 ? "todos gerados" : faltam + " a gerar"),
            rotulo + ": PDFs já gerados / documentos com XML completo e PDF liberado no cadastro do CNPJ");
    },

    // ---------------------------------------------------------------- RETORNOS E GED
    textoRetorno: function (ds) {
        var U = painelXMLUtil;
        if (!ds || !ds.values || !ds.values.length) return "sem retorno do servidor (o dataset só responde ao usuário técnico, ao administrador ou ao grupo fiscal)";
        var textos = [];
        for (var i = 0; i < ds.values.length; i++) {
            textos.push((U.valor(ds.values[i], "STATUS") + " " + U.valor(ds.values[i], "CHAVE") + " " + U.valor(ds.values[i], "MENSAGEM")).replace(/^\s+|\s+$/g, ""));
        }
        return textos.join(" | ");
    },
    // Arquivos que não entraram na importação: REJEITADO/ERRO do dataset (DETALHE traz o documentId do GED).
    // nomes: { documentId: nome do arquivo }. Sem retorno do servidor, nenhum arquivo foi processado.
    falhasDaImportacao: function (ds, nomes) {
        var U = painelXMLUtil, falhas = [];
        var todos = [];
        for (var id in nomes) if (nomes.hasOwnProperty(id)) todos.push(nomes[id]);
        if (!ds || !ds.values || !ds.values.length) {
            return [{ arquivo: todos.join(", "), motivo: "O servidor não respondeu à importação (o dataset só responde ao usuário técnico, ao administrador ou ao grupo fiscal).", chave: "", docId: "" }];
        }
        for (var i = 0; i < ds.values.length; i++) {
            var linha = ds.values[i];
            var status = String(U.valor(linha, "STATUS"));
            if (status !== "REJEITADO" && status !== "ERRO") continue;
            var docId = String(U.valor(linha, "DETALHE"));
            falhas.push({
                arquivo: nomes[docId] || todos.join(", "),
                motivo: String(U.valor(linha, "MENSAGEM")) || "Motivo não informado.",
                chave: String(U.valor(linha, "CHAVE")),
                docId: nomes[docId] ? docId : ""
            });
        }
        return falhas;
    },
    // Avisos que o motor devolve junto da importação (linhas ALERTA), por exemplo nota fora do período exibido.
    alertasDaImportacao: function (ds) {
        var U = painelXMLUtil, avisos = [];
        for (var i = 0; ds && ds.values && i < ds.values.length; i++) {
            if (String(U.valor(ds.values[i], "STATUS")) === "ALERTA") avisos.push(String(U.valor(ds.values[i], "MENSAGEM")));
        }
        return avisos;
    },
    // O que o usuário pode fazer, conforme o motivo devolvido pelo motor.
    orientacaoFalha: function (motivo) {
        var m = String(motivo || "").toLowerCase();
        if (m.indexOf("cnpj não monitorado") >= 0) return "O CNPJ do tomador/destinatário desta nota não está nos Parâmetros. Se a empresa é do grupo, cadastre o CNPJ e importe de novo. Se não é, não há nada a fazer.";
        if (m.indexOf("xml não reconhecido") >= 0) return "O arquivo não é um XML fiscal que o painel conheça, ou o layout dessa prefeitura ainda não é suportado. Se a nota é válida, abra um chamado informando o arquivo.";
        if (m.indexOf("assinatura") >= 0) return "A assinatura digital do XML não confere. Peça um novo arquivo ao emissor; se continuar, abra um chamado.";
        return "Tente importar de novo. Se o problema continuar, abra um chamado.";
    },
    copiarTexto: function (texto, aoCopiar, aoFalhar) {
        var reserva = function () {
            var campo = document.createElement("textarea");
            campo.value = texto;
            document.body.appendChild(campo);
            campo.select();
            try { document.execCommand("copy"); aoCopiar(); } catch (e) { aoFalhar(); }
            document.body.removeChild(campo);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(aoCopiar, reserva);
        else reserva();
    },
    urlGed: function (docId) {
        var empresa = (typeof WCMAPI !== "undefined" && WCMAPI.organizationId) ? WCMAPI.organizationId : 1;
        return "/portal/p/" + empresa + "/ecmnavigation?app_ecm_navigation_doc=" + docId;
    },
    // Le o CONTEUDO de um arquivo do GED: pede o endereco de download a API publica do Fluig e baixa os bytes.
    // callback(erro, bytes[ArrayBuffer]). A ecmnavigation NAO serve: ela so abre o explorador do GED, nao o arquivo.
    lerConteudo: function (docId, callback) {
        $.ajax({
            url: "/api/public/2.0/documents/getDownloadURL/" + encodeURIComponent(docId),
            type: "GET",
            dataType: "json",
            success: function (ret) {
                var url = ret && (typeof ret.content === "string" ? ret.content : (ret.content && ret.content.url));
                if (!url) { callback("o Fluig não devolveu o endereço de download do documento " + docId); return; }
                // Mesmo dominio da pagina (evita conteudo misto http/https e CORS quando o Fluig anuncia o host interno).
                url = String(url).replace(/^https?:\/\/[^\/]+/i, "");
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.responseType = "arraybuffer";
                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 300) callback(null, xhr.response);
                    else callback("download do documento " + docId + " falhou (HTTP " + xhr.status + ")");
                };
                xhr.onerror = function () { callback("download do documento " + docId + " falhou"); };
                xhr.send();
            },
            error: function (x) { callback("o Fluig recusou o download do documento " + docId + " (HTTP " + (x && x.status) + ")"); }
        });
    },
    textoUtf8: function (bytes) {
        if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(bytes);
        var bin = "", u8 = new Uint8Array(bytes);
        for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
        try { return decodeURIComponent(escape(bin)); } catch (e) { return bin; }
    },
    // XML do GED costuma vir numa linha so: indenta para leitura (so exibicao, o arquivo nao muda).
    formatarXml: function (xml) {
        var partes = String(xml).replace(/^\s+|\s+$/g, "").replace(/>\s*</g, ">\n<").split("\n"), nivel = 0, saida = [];
        for (var i = 0; i < partes.length; i++) {
            var p = partes[i];
            if (/^<\//.test(p)) nivel = Math.max(0, nivel - 1);
            saida.push(new Array(nivel + 1).join("  ") + p);
            if (/^<[^!?\/][^>]*>$/.test(p) && !/\/>$/.test(p)) nivel++;
        }
        return saida.join("\n");
    },
    // CSV para o Excel brasileiro: separador ";", decimal com virgula, BOM UTF-8.
    csv: function (linhas) {
        var U = painelXMLUtil;
        var q = function (t) { return '"' + String(t == null ? "" : t).replace(/"/g, '""') + '"'; };
        var saida = "﻿TIPO;CHAVE;NUMERO;SERIE;EMITENTE;CNPJ_EMITENTE;CNPJ_CONSULTADO;EMISSAO;VALOR;SITUACAO;ORIGEM;ESTADO_ERP;ERP;AUTENTICIDADE;PDF\r\n";
        for (var i = 0; i < linhas.length; i++) {
            var l = linhas[i];
            saida += [U.valor(l, "TIPO"), U.valor(l, "CHAVE"), U.valor(l, "NUMERO"), U.valor(l, "SERIE"), q(U.valor(l, "EMITENTE")), U.valor(l, "CNPJ_EMITENTE"),
                U.valor(l, "CNPJ"), U.dataBr(U.valor(l, "EMISSAO")), String(U.valor(l, "VALOR")).replace(".", ","), U.valor(l, "SITUACAO"), U.valor(l, "ORIGEM"),
                U.estadoOperacao(l), U.valor(l, "ERP_NOME"), U.valor(l, "AUTENTICIDADE"), U.estadoPdf(l)].join(";") + "\r\n";
        }
        return saida;
    },
    enviarArquivo: function (arquivo, pastaGed, callback) {
        var leitor = new FileReader();
        leitor.onload = function () {
            try {
                var fd = new FormData();
                fd.append("files", arquivo);
                var xhr = new XMLHttpRequest();
                xhr.open("POST", "/ecm/upload", true);
                xhr.onload = function () {
                    try {
                        var resposta = JSON.parse(xhr.responseText);
                        var nome = resposta.files ? resposta.files[0].name : arquivo.name;
                        $.ajax({
                            url: "/api/public/ecm/document/createDocument",
                            type: "POST",
                            contentType: "application/json",
                            data: JSON.stringify({
                                description: arquivo.name,
                                parentId: parseInt(pastaGed, 10) || 0,
                                attachments: [{ fileName: nome, principal: true }]
                            }),
                            success: function (ret) {
                                callback(ret && ret.content ? ret.content.id : null, "Upload sem id.");
                            },
                            error: function () { callback(null, "Falha ao criar o documento " + arquivo.name); }
                        });
                    } catch (e) {
                        callback(null, "Falha no upload de " + arquivo.name);
                    }
                };
                xhr.send(fd);
            } catch (e) {
                callback(null, "" + e);
            }
        };
        leitor.readAsArrayBuffer(arquivo);
    }
};

var painelXML = SuperWidget.extend({
    // Preferencias da instancia: chegam pelo data-params do view.ftl.
    pastaGed: "",
    urlParametros: "",

    init: function () {
        var id = this.instanceId;
        // O mesmo JS roda no modo de edicao (edit.ftl): so segue se for a tela de consulta.
        if (!$("#kpis_" + id).length) return;
        this.reiniciarEstado();
        var hoje = new Date();
        var inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        $("#inicio_" + id).val(painelXMLUtil.dataIso(inicio));
        $("#fim_" + id).val(painelXMLUtil.dataIso(hoje));
        this.tamanho = parseInt($("#tamanho_" + id).val(), 10) || 25;
        this.renderKpis();
        this.carregarStatus();
    },

    // Estado da tela: dados = tudo que a consulta devolveu; filtrados = depois dos filtros; a grade mostra uma pagina.
    reiniciarEstado: function () {
        this.dados = [];
        this.filtrados = [];
        this.indice = {};
        this.selecionados = {};
        this.filtros = { status: "", emitente: "", cnpjEmitente: "", numero: "", pdf: "" };
        this.pagina = 1;
        this.tamanho = 25;
        this.ultimaBusca = false;
        this.emLote = false;
        this.kpis = null;
    },

    bindings: {
        local: {
            "aba": ["click_mudarAba"],
            "buscar": ["click_buscar"],
            "atualizar": ["click_atualizar"],
            "sync": ["click_sincronizar"],
            "importar": ["click_escolherArquivos"],
            "importar-arquivo": ["change_importar"],
            "manifestar": ["click_manifestar"],
            "aplicar-filtros": ["click_aplicarFiltros"],
            "limpar-filtros": ["click_limparFiltros"],
            "filtro-auto": ["change_aplicarFiltros"],
            "kpi": ["click_filtrarKpi"],
            "selecionar": ["change_selecionarLinha"],
            "selecionar-todos": ["change_selecionarTodos"],
            "pagina": ["click_irPagina"],
            "tamanho": ["change_mudarTamanho"],
            "pdf": ["click_baixarPdf"],
            "gerar-pendentes": ["click_gerarPendentes"],
            "reenviar": ["click_reenviar"],
            "reenviar-selecionados": ["click_reenviarSelecionados"],
            "reenviar-massa": ["click_reenviarPendentes"],
            "exportar": ["click_exportarCsv"],
            "copiar": ["click_copiarChave"],
            "detalhes": ["click_abrirDetalhes"],
            "xml": ["click_abrirXml"],
            "save-preferences": ["click_savePreferences"]
        },
        global: {}
    },

    // ------------------------------------------------------------------ PREFERENCIAS (edit.ftl)
    savePreferences: function () {
        var id = this.instanceId;
        var preferences = {
            urlParametros: $("#urlParametros_" + id).val(),
            pastaGed: $("#pastaGed_" + id).val()
        };
        WCMSpaceAPI.PageService.UPDATEPREFERENCES({
            async: true,
            success: function () {
                FLUIGC.toast({ title: "", message: "Preferências salvas.", type: "success" });
            },
            fail: function () {
                FLUIGC.toast({ title: "", message: "Não foi possível salvar as preferências.", type: "danger" });
            }
        }, id, preferences);
    },

    // ------------------------------------------------------------------ CONSULTA
    // Abas: "docs" (consulta e grade) e "sync" (status do sync, Atualizar e Sincronizar).
    mudarAba: function (el, ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        var id = this.instanceId;
        var aba = $(el).attr("data-aba");
        var raiz = $("#painelXML_" + id);
        raiz.find(".pxml-tabs li").removeClass("active");
        $(el).closest("li").addClass("active");
        raiz.find(".pxml-pane").removeClass("active");
        $("#pane_" + aba + "_" + id).addClass("active");
    },

    // Aba Status do Sync: recarrega so o status (a consulta de documentos se refaz pelo Buscar, na outra aba).
    atualizar: function () {
        this.carregarStatus();
        this.aviso("Status atualizado.", true);
    },

    buscar: function () {
        var id = this.instanceId;
        var cnpj = painelXMLUtil.normalizarCnpj($("#cnpj_" + id).val());
        var inicio = $("#inicio_" + id).val();
        var fim = $("#fim_" + id).val();
        // O CNPJ é opcional na busca; só o período é obrigatório.
        if (!inicio || !fim) {
            this.aviso("Informe o período.");
            return;
        }
        var constraints = [
            DatasetFactory.createConstraint("CNPJ", cnpj, cnpj, ConstraintType.MUST),
            DatasetFactory.createConstraint("INICIO", inicio, inicio, ConstraintType.MUST),
            DatasetFactory.createConstraint("FIM", fim, fim, ConstraintType.MUST),
            DatasetFactory.createConstraint("TIPO", $("#tipo_" + id).val(), $("#tipo_" + id).val(), ConstraintType.MUST),
            DatasetFactory.createConstraint("CHAVE", $("#chave_" + id).val(), $("#chave_" + id).val(), ConstraintType.MUST)
        ];
        var ds = DatasetFactory.getDataset("ds_xf_documentos", null, constraints, null);
        this.ultimaBusca = true;
        this.carregar(ds);
        this.carimbo();
    },

    carregarStatus: function () {
        var U = painelXMLUtil;
        var corpo = $("#status_" + this.instanceId);
        var ds = DatasetFactory.getDataset("ds_xf_status", null, [], null);
        var cores = { OK: "label-success", ATRASADO: "label-danger", ERRO: "label-danger", EM_EXECUCAO: "label-info", NUNCA: "label-warning", DESLIGADO: "label-default" };
        var ultima = "";
        corpo.empty();
        this.carimbo();
        if (!ds || !ds.values) return;
        for (var i = 0; i < ds.values.length; i++) {
            var l = ds.values[i];
            var sit = U.valor(l, "SITUACAO");
            var ok = String(U.valor(l, "ULTIMA_OK"));
            if (ok > ultima) ultima = ok;
            corpo.append("<tr><td>" + U.esc(U.valor(l, "TIPO") === "PASTA" ? U.valor(l, "CNPJ") : U.formatarCnpj(U.valor(l, "CNPJ"))) + "</td><td>" + U.esc(U.valor(l, "TIPO")) +
                "</td><td><span class='label " + (cores[sit] || "label-default") + "'>" + U.esc(sit) + "</span></td><td>" + U.esc(U.valor(l, "ULTIMA_OK")) +
                "</td><td>" + U.esc(U.valor(l, "DIAS")) + "</td><td>" + U.esc(U.valor(l, "ULT_NSU")) + "</td><td>" + U.esc(U.valor(l, "NOVOS")) +
                "</td><td>" + U.esc(U.valor(l, "CSTAT")) + "</td><td>" + U.esc(U.valor(l, "PROXIMA")) + "</td><td>" + U.esc(U.valor(l, "ERRO")) + "</td></tr>");
        }
        $("#sync_" + this.instanceId).text(ultima || "--");
    },

    // Recebe o resultado da consulta ao servidor e monta a tela.
    carregar: function (ds) {
        var U = painelXMLUtil;
        this.dados = ds && ds.values ? ds.values : [];
        this.indice = {};
        this.selecionados = {};
        for (var i = 0; i < this.dados.length; i++) this.indice[String(U.valor(this.dados[i], "CHAVE"))] = this.dados[i];
        this.aplicarFiltros();
        this.aviso(this.dados.length ? this.dados.length + " documento(s)." : "Nenhum documento no filtro.");
    },

    // ------------------------------------------------------------------ FILTROS, SELECAO E PAGINACAO (no navegador)
    lerFiltros: function () {
        var id = this.instanceId;
        var v = function (campo) { return String($("#" + campo + "_" + id).val() || ""); };
        this.filtros = {
            status: v("filtroStatus"),
            emitente: v("filtroEmitente").toLowerCase().replace(/^\s+|\s+$/g, ""),
            cnpjEmitente: v("filtroCnpjEmit").replace(/\D/g, ""),
            numero: v("filtroNumero").replace(/^\s+|\s+$/g, ""),
            pdf: v("filtroPdf")
        };
        return this.filtros;
    },

    aplicarFiltros: function () {
        var U = painelXMLUtil;
        var f = this.lerFiltros();
        var saida = [];
        for (var i = 0; i < this.dados.length; i++) {
            var l = this.dados[i];
            if (f.status && U.estadoOperacao(l) !== f.status) continue;
            if (f.emitente && String(U.valor(l, "EMITENTE")).toLowerCase().indexOf(f.emitente) === -1) continue;
            if (f.cnpjEmitente && String(U.valor(l, "CNPJ_EMITENTE")).replace(/\D/g, "").indexOf(f.cnpjEmitente) === -1) continue;
            if (f.numero && String(U.valor(l, "NUMERO")).indexOf(f.numero) === -1) continue;
            if (f.pdf && U.estadoPdf(l) !== f.pdf) continue;
            saida.push(l);
        }
        this.filtrados = saida;
        this.pagina = 1;
        this.renderKpis();
        this.renderGrid();
    },

    limparFiltros: function () {
        var id = this.instanceId;
        $("#filtroStatus_" + id + ", #filtroPdf_" + id + ", #filtroEmitente_" + id + ", #filtroCnpjEmit_" + id + ", #filtroNumero_" + id).val("");
        this.aplicarFiltros();
    },

    // Clique num cartao da operacao filtra a grade por aquela situacao (Total limpa o filtro).
    filtrarKpi: function (el) {
        var status = String($(el).attr("data-kpi") || "");
        $("#filtroStatus_" + this.instanceId).val(this.filtros && this.filtros.status === status ? "" : status);
        this.aplicarFiltros();
    },

    mudarTamanho: function (el) {
        this.tamanho = parseInt($(el).val(), 10) || 25;
        this.pagina = 1;
        this.renderGrid();
    },

    irPagina: function (el, ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        var p = parseInt($(el).attr("data-pagina"), 10);
        if (!p || p < 1) return;
        this.pagina = p;
        this.renderGrid();
    },

    totalPaginas: function () {
        return Math.max(1, Math.ceil(this.filtrados.length / this.tamanho));
    },

    paginaAtual: function () {
        if (this.pagina > this.totalPaginas()) this.pagina = this.totalPaginas();
        var ini = (this.pagina - 1) * this.tamanho;
        return this.filtrados.slice(ini, ini + this.tamanho);
    },

    selecionarLinha: function (el) {
        var chave = String($(el).attr("data-chave"));
        if ($(el).is(":checked")) this.selecionados[chave] = true;
        else delete this.selecionados[chave];
        this.atualizarSelecao();
    },

    selecionarTodos: function (el) {
        var marcar = $(el).is(":checked");
        var pagina = this.paginaAtual();
        for (var i = 0; i < pagina.length; i++) {
            var chave = String(painelXMLUtil.valor(pagina[i], "CHAVE"));
            if (marcar) this.selecionados[chave] = true;
            else delete this.selecionados[chave];
        }
        this.renderGrid();
    },

    chavesSelecionadas: function () {
        var lista = [];
        for (var k in this.selecionados) if (this.selecionados.hasOwnProperty(k)) lista.push(k);
        return lista;
    },

    atualizarSelecao: function () {
        var id = this.instanceId;
        var pagina = this.paginaAtual();
        var todas = pagina.length > 0;
        for (var i = 0; i < pagina.length; i++) {
            if (!this.selecionados[String(painelXMLUtil.valor(pagina[i], "CHAVE"))]) { todas = false; break; }
        }
        $("#contador_" + id).text(this.chavesSelecionadas().length);
        $("#selTodos_" + id).prop("checked", todas);
    },

    // ------------------------------------------------------------------ RENDER
    renderKpis: function () {
        var U = painelXMLUtil;
        var id = this.instanceId;
        var c = U.contagens(this.dados);
        this.kpis = c;
        var ativo = this.filtros ? this.filtros.status : "";
        var erp = U.nomeErp(c.erps);
        $("#kpisOp_" + id).html(
            U.kpi("Total recuperados", c.total, "blue", c.SEM_ERP ? c.SEM_ERP + " sem ERP" : "", "Todos os documentos da consulta", "", ativo === "") +
            U.kpi("Integrados " + erp, c.INTEGRADO, "green", "", "Enviados com sucesso ao " + erp + ". Clique para filtrar", "INTEGRADO", ativo === "INTEGRADO") +
            U.kpi("Pendentes de envio", c.PENDENTE, "amber", "", "Ainda não enviados ao ERP (CNPJ com Enviar ao ERP marcado). Clique para filtrar", "PENDENTE", ativo === "PENDENTE") +
            U.kpi("Com erro de envio", c.ERRO, "red", "", "O ERP recusou ou não respondeu. Clique para filtrar", "ERRO", ativo === "ERRO") +
            U.kpi("Cancelados", c.CANCELADO, "gray", "", "Cancelados na SEFAZ. Clique para filtrar", "CANCELADO", ativo === "CANCELADO")
        );
        $("#kpis_" + id).html(
            U.kpi("NF-e", c.tipo.NFE, "blue") + U.kpi("CT-e", c.tipo.CTE, "green") + U.kpi("NFS-e", c.tipo.NFSE, "purple") +
            U.kpi("Concessionária", c.tipo.NF3E + c.tipo.NFCOM, "amber") +
            U.kpiPdf("DANFE", c.pdf.NFE, "blue") + U.kpiPdf("DANFSe/Espelho", c.pdf.NFSE, "purple")
        );
    },

    linhaHtml: function (l) {
        var U = painelXMLUtil;
        var chave = String(U.valor(l, "CHAVE"));
        var marcada = this.selecionados[chave] ? " checked" : "";
        var eventos = parseInt(U.valor(l, "EVENTOS"), 10) || 0;
        var reenviar = U.podeReenviar(l) ? " <button type='button' class='btn btn-xs btn-warning' data-reenviar data-chave='" + U.esc(chave) + "' title='Reenviar ao " + U.esc(U.rotuloErp(U.valor(l, "ERP_NOME"))) + "'>Reenviar</button>" : "";
        return "<tr data-chave='" + U.esc(chave) + "' data-pdfestado='" + U.estadoPdf(l) + "'>" +
            "<td class='text-center'><input type='checkbox' data-selecionar data-chave='" + U.esc(chave) + "'" + marcada + " /></td>" +
            "<td>" + U.esc(U.valor(l, "TIPO")) + "</td>" +
            "<td><code class='pxml-chave' title='" + U.esc(chave) + "'>" + U.esc(U.chaveCurta(chave)) + "</code> " +
            "<button type='button' class='btn btn-xs btn-link' data-copiar data-chave='" + U.esc(chave) + "' title='Copiar a chave'>Copiar</button></td>" +
            "<td>" + U.esc(U.valor(l, "NUMERO")) + (U.valor(l, "SERIE") ? "/" + U.esc(U.valor(l, "SERIE")) : "") + "</td>" +
            "<td>" + U.esc(U.valor(l, "EMITENTE")) + "</td>" +
            "<td>" + U.esc(U.formatarCnpj(U.valor(l, "CNPJ_EMITENTE"))) + "</td>" +
            "<td>" + U.esc(U.dataBr(U.valor(l, "EMISSAO"))) + "</td>" +
            "<td class='text-right'>" + U.esc(U.moeda(U.valor(l, "VALOR"))) + "</td>" +
            "<td>" + U.esc(U.valor(l, "SITUACAO")) + "</td>" +
            "<td>" + U.esc(U.valor(l, "ORIGEM")) + "</td>" +
            "<td>" + U.selo(l) + "</td>" +
            "<td>" + U.esc(U.valor(l, "AUTENTICIDADE")) + "</td>" +
            "<td class='text-nowrap'><button type='button' class='btn btn-xs btn-default' data-xml data-ged='" + U.esc(U.valor(l, "ID_GED")) + "' data-chave='" + U.esc(chave) + "'>XML</button>" +
            U.botaoPdf(l) + reenviar +
            " <button type='button' class='btn btn-xs btn-default' data-detalhes data-chave='" + U.esc(chave) + "' title='Integração com o ERP e eventos do documento'>Detalhes" + (eventos ? " (" + eventos + " ev.)" : "") + "</button>" +
            "</td></tr>";
    },

    renderGrid: function () {
        var id = this.instanceId;
        var corpo = $("#grade_" + id);
        var pagina = this.paginaAtual();
        var html = "";
        for (var i = 0; i < pagina.length; i++) html += this.linhaHtml(pagina[i]);
        corpo.html(html);
        this.renderPaginacao();
        this.atualizarSelecao();
    },

    renderPaginacao: function () {
        var id = this.instanceId;
        var total = this.filtrados.length;
        var paginas = this.totalPaginas();
        var ini = total ? (this.pagina - 1) * this.tamanho + 1 : 0;
        var fim = Math.min(total, this.pagina * this.tamanho);
        var filtradosDe = this.filtrados.length !== this.dados.length ? " (filtrado de " + this.dados.length + ")" : "";
        $("#paginacaoTexto_" + id).text(total ? "Exibindo " + ini + " a " + fim + " de " + total + " registro(s)" + filtradosDe : "Nenhum registro");
        var de = Math.max(1, Math.min(this.pagina - 2, paginas - 4));
        var ate = Math.min(paginas, de + 4);
        var lis = "<li" + (this.pagina === 1 ? " class='disabled'" : "") + "><a href='#' data-pagina='" + Math.max(1, this.pagina - 1) + "'>&laquo;</a></li>";
        for (var p = de; p <= ate; p++) lis += "<li" + (p === this.pagina ? " class='active'" : "") + "><a href='#' data-pagina='" + p + "'>" + p + "</a></li>";
        lis += "<li" + (this.pagina === paginas ? " class='disabled'" : "") + "><a href='#' data-pagina='" + Math.min(paginas, this.pagina + 1) + "'>&raquo;</a></li>";
        $("#paginacao_" + id).html(paginas > 1 ? lis : "");
    },

    // ------------------------------------------------------------------ IMPORTAR / SINCRONIZAR / MANIFESTAR
    escolherArquivos: function () {
        $("#arquivos_" + this.instanceId).click();
    },

    importar: function (el) {
        var that = this;
        var arquivos = el && el.files;
        if (!arquivos || !arquivos.length) return;
        var pendentes = arquivos.length;
        var ids = [], nomes = {}, falhas = [];
        this.aviso("Enviando " + pendentes + " arquivo(s).");
        var enviar = function (arquivo) {
            painelXMLUtil.enviarArquivo(arquivo, that.pastaGed, function (docId, erro) {
                if (docId) {
                    ids.push(docId);
                    nomes[String(docId)] = arquivo.name;
                } else {
                    that.aviso(erro);
                    falhas.push({ arquivo: arquivo.name, motivo: "Não foi possível enviar o arquivo ao GED: " + erro, chave: "", docId: "" });
                }
                pendentes--;
                if (pendentes !== 0) return;
                if (ids.length) {
                    var ds = null, chamou = false, avisos = [];
                    try {
                        var constraints = [
                            DatasetFactory.createConstraint("DOCUMENT_IDS", ids.join(","), ids.join(","), ConstraintType.MUST),
                            DatasetFactory.createConstraint("ID_PASTA_GED", that.pastaGed, that.pastaGed, ConstraintType.MUST)
                        ];
                        // O período da tela vai junto para o motor avisar se a nota importada ficar fora dele.
                        var inicio = $("#inicio_" + that.instanceId).val(), fim = $("#fim_" + that.instanceId).val();
                        if (inicio && fim) {
                            constraints.push(DatasetFactory.createConstraint("INICIO", inicio, inicio, ConstraintType.MUST));
                            constraints.push(DatasetFactory.createConstraint("FIM", fim, fim, ConstraintType.MUST));
                        }
                        ds = DatasetFactory.getDataset("ds_xf_importar_arquivo", null, constraints, null);
                        chamou = true;
                    } catch (e) {
                        falhas.push({ arquivo: ids.map(function (id) { return nomes[String(id)]; }).join(", "), motivo: "Falha ao chamar o servidor: " + e, chave: "", docId: "" });
                        that.aviso("Falha ao importar: " + e);
                    }
                    if (chamou) {
                        that.mostrarRetorno(ds);
                        falhas = falhas.concat(painelXMLUtil.falhasDaImportacao(ds, nomes));
                        avisos = painelXMLUtil.alertasDaImportacao(ds);
                    }
                    that.buscar();
                    // A busca reescreve a linha de aviso; o alerta vai depois dela e também como toast.
                    if (avisos.length) {
                        var texto = avisos.join(" ");
                        that.aviso(texto);
                        if (typeof FLUIGC !== "undefined" && FLUIGC.toast) FLUIGC.toast({ title: "", message: texto, type: "warning" });
                    }
                }
                that.alertarFalhas(falhas);
            });
        };
        for (var i = 0; i < arquivos.length; i++) enviar(arquivos[i]);
        $(el).val("");
    },

    // Modal para o usuário decidir o que fazer quando algum XML não foi importado: corrigir o cadastro, tentar de novo ou abrir chamado.
    alertarFalhas: function (falhas) {
        if (!falhas || !falhas.length) return;
        var U = painelXMLUtil, id = this.instanceId;
        var linhas = "";
        for (var i = 0; i < falhas.length; i++) {
            linhas += "<tr><td class='pxml-falha-arquivo'>" + U.esc(falhas[i].arquivo) + "</td><td>" + U.esc(falhas[i].motivo) +
                "<div class='text-muted pxml-falha-dica'>" + U.esc(U.orientacaoFalha(falhas[i].motivo)) + "</div></td></tr>";
        }
        var html = "<p>" + (falhas.length === 1 ? "Não foi possível importar 1 arquivo." : "Não foi possível importar " + falhas.length + " arquivos.") + " Veja o motivo abaixo. Se não conseguir resolver, abra um chamado pelo canal de suporte da sua empresa informando o nome do arquivo e o motivo.</p>" +
            "<table class='table table-condensed pxml-falhas'><thead><tr><th>Arquivo</th><th>Motivo e o que fazer</th></tr></thead><tbody>" + linhas + "</tbody></table>";
        if (typeof FLUIGC !== "undefined" && FLUIGC.modal) {
            FLUIGC.modal({ title: "Arquivo não importado", content: html, id: "modal-falhas-" + id, size: "large", actions: [{ label: "Fechar", autoClose: true }] });
        } else {
            var resumo = [];
            for (var j = 0; j < falhas.length; j++) resumo.push(falhas[j].arquivo + ": " + falhas[j].motivo);
            this.aviso("Arquivo(s) não importado(s): " + resumo.join(" | "));
        }
    },

    // Mostra o conteudo do XML em tela (modal), lido do GED.
    abrirXml: function (el) {
        var that = this, U = painelXMLUtil;
        var ged = $(el).attr("data-ged");
        var l = this.indice[String($(el).attr("data-chave"))];
        if (!ged) {
            this.aviso("Este documento não tem XML no GED.");
            return;
        }
        this.aviso("Abrindo o XML...");
        U.lerConteudo(ged, function (erro, bytes) {
            if (erro) {
                that.aviso("Não foi possível abrir o XML: " + erro + ".");
                return;
            }
            var texto = U.formatarXml(U.textoUtf8(bytes));
            var titulo = "XML " + (l ? U.esc(U.valor(l, "TIPO")) + " " + U.esc(U.valor(l, "NUMERO")) : "");
            if (typeof FLUIGC !== "undefined" && FLUIGC.modal) {
                FLUIGC.modal({ title: titulo, content: "<pre class='pxml-xml'>" + U.esc(texto) + "</pre>", id: "modal-xml-" + that.instanceId, size: "large", actions: [{ label: "Fechar", autoClose: true }] });
            }
            that.aviso("");
        });
    },

    // Abre o PDF do GED numa aba (a janela e aberta ja no clique para o navegador nao bloquear o pop-up).
    visualizarPdf: function (docId, rotulo, janela) {
        var that = this;
        painelXMLUtil.lerConteudo(docId, function (erro, bytes) {
            if (erro) {
                if (janela && janela.close) janela.close();
                that.aviso("Não foi possível abrir o " + rotulo + ": " + erro + ".");
                return;
            }
            var url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
            if (janela && janela.location) janela.location.href = url;
            else window.open(url, "_blank");
            that.aviso("");
        });
    },

    manifestar: function () {
        var id = this.instanceId;
        var cnpj = painelXMLUtil.normalizarCnpj($("#cnpj_" + id).val());
        var chave = $("#chave_" + id).val();
        if (!cnpj || !chave) {
            this.aviso("Informe o CNPJ e a chave da NF-e.");
            return;
        }
        var ds = DatasetFactory.getDataset("ds_xf_manifestar", null, [
            DatasetFactory.createConstraint("CNPJ", cnpj, cnpj, ConstraintType.MUST),
            DatasetFactory.createConstraint("CHAVE", chave, chave, ConstraintType.MUST)
        ], null);
        this.mostrarRetorno(ds);
    },

    sincronizar: function () {
        var ds = DatasetFactory.getDataset("ds_xf_sync", null, [
            DatasetFactory.createConstraint("ID_PASTA_GED", this.pastaGed, this.pastaGed, ConstraintType.MUST)
        ], null);
        this.mostrarRetorno(ds, true);
        this.carregarStatus();
    },

    // ------------------------------------------------------------------ DANFE / DANFSe
    // Gera (ou localiza) o PDF do documento. Devolve { ok, id } ou { ok: false, ds }.
    gerarUm: function (linha) {
        var U = painelXMLUtil;
        var tipo = String(U.valor(linha, "TIPO"));
        var chave = String(U.valor(linha, "CHAVE"));
        var ds = DatasetFactory.getDataset(tipo === "NFE" ? "ds_xf_danfe" : "ds_xf_danfse", null, [
            DatasetFactory.createConstraint("CHAVE", chave, chave, ConstraintType.MUST),
            DatasetFactory.createConstraint("ID_PASTA_GED", this.pastaGed, this.pastaGed, ConstraintType.MUST)
        ], null);
        var ret = ds && ds.values && ds.values.length ? ds.values[0] : null;
        if (ret && U.valor(ret, "STATUS") === "SUCESSO") {
            var id = U.valor(ret, "DETALHE");
            linha.ID_GED_PDF = id;
            return { ok: true, id: id };
        }
        return { ok: false, ds: ds };
    },

    // PDF ja gravado abre direto; senao o motor gera a partir do XML (o ADN nao entrega mais o DANFSe e a SEFAZ nunca entregou o DANFE).
    baixarPdf: function (el) {
        var U = painelXMLUtil;
        var linha = this.indice[String($(el).attr("data-chave"))];
        if (!linha) return;
        var rotulo = U.rotuloPdf(linha);
        var pronto = U.valor(linha, "ID_GED_PDF");
        var janela = window.open("", "_blank");
        if (pronto) {
            this.visualizarPdf(pronto, rotulo, janela);
            return;
        }
        this.aviso("Gerando o " + rotulo + "...");
        var r = this.gerarUm(linha);
        if (r.ok) {
            this.redesenhar();
            this.visualizarPdf(r.id, rotulo, janela);
        } else {
            if (janela && janela.close) janela.close();
            this.mostrarRetorno(r.ds);
        }
    },

    // Pendentes de PDF entre TODOS os documentos filtrados (nao so a pagina). LIMITE_LOTE por clique.
    pendentesPdf: function () {
        var lista = [];
        for (var i = 0; i < this.filtrados.length; i++) {
            if (painelXMLUtil.estadoPdf(this.filtrados[i]) === "pendente") lista.push(this.filtrados[i]);
        }
        return lista;
    },

    gerarPendentes: function () {
        var that = this;
        if (this.emLote) return;
        var todos = this.pendentesPdf();
        if (!todos.length) {
            this.aviso("Não há DANFE, DANFSe ou espelho a gerar nos documentos filtrados.");
            return;
        }
        var lote = todos.slice(0, painelXMLUtil.LIMITE_LOTE);
        this.executarLote(lote, todos.length, "PDF(s) gerado(s)", function (linha) {
            var r = that.gerarUm(linha);
            return r.ok ? { ok: true } : { ok: false, msg: painelXMLUtil.textoRetorno(r.ds) };
        });
    },

    // ------------------------------------------------------------------ ERP (TOTVS RM no CEM, TOTVS Datasul na ICE)
    // Reenvia um documento: ds_xf_erp aceita a CHAVE e devolve a linha do envio (INTEGRADO ou ERRO).
    reenviarUm: function (linha) {
        var U = painelXMLUtil;
        var chave = String(U.valor(linha, "CHAVE"));
        var tipo = String(U.valor(linha, "TIPO"));
        var ds = DatasetFactory.getDataset("ds_xf_erp", null, [
            DatasetFactory.createConstraint("CHAVE", chave, chave, ConstraintType.MUST),
            DatasetFactory.createConstraint("TIPO", tipo, tipo, ConstraintType.MUST)
        ], null);
        var ret = ds && ds.values && ds.values.length ? ds.values[0] : null;
        if (!ret) return { ok: false, msg: "o ERP não foi acionado (sem retorno: usuário sem permissão ou CNPJ sem Enviar ao ERP)" };
        // Falha do proprio motor (excecao): a linha volta sem CHAVE e nao diz nada do ERP.
        if (!U.valor(ret, "CHAVE")) return { ok: false, msg: U.valor(ret, "MENSAGEM") };
        var status = String(U.valor(ret, "STATUS")).toUpperCase();
        linha.ERP = status;
        linha.ERP_MSG = U.valor(ret, "MENSAGEM");
        return status === "INTEGRADO" ? { ok: true } : { ok: false, msg: U.valor(ret, "MENSAGEM") };
    },

    reenviar: function (el) {
        var linha = this.indice[String($(el).attr("data-chave"))];
        if (!linha || !painelXMLUtil.podeReenviar(linha)) return;
        this.confirmar("Reenviar o documento " + painelXMLUtil.valor(linha, "NUMERO") + " ao " + painelXMLUtil.rotuloErp(painelXMLUtil.valor(linha, "ERP_NOME")) + "?", [linha]);
    },

    reenviarSelecionados: function () {
        var chaves = this.chavesSelecionadas();
        if (!chaves.length) {
            this.aviso("Selecione ao menos um documento para reenviar.");
            return;
        }
        var linhas = [];
        for (var i = 0; i < chaves.length; i++) {
            var l = this.indice[chaves[i]];
            if (l && painelXMLUtil.podeReenviar(l)) linhas.push(l);
        }
        if (!linhas.length) {
            this.aviso("Nenhum dos selecionados está pendente ou com erro de envio (já integrados, cancelados ou sem ERP).");
            return;
        }
        this.confirmar("Reenviar " + linhas.length + " documento(s) selecionado(s) ao ERP?", linhas);
    },

    reenviarPendentes: function () {
        var linhas = [];
        for (var i = 0; i < this.filtrados.length; i++) if (painelXMLUtil.podeReenviar(this.filtrados[i])) linhas.push(this.filtrados[i]);
        if (!linhas.length) {
            this.aviso("Não há documentos pendentes ou com erro de envio nos filtrados.");
            return;
        }
        this.confirmar("Reenviar " + linhas.length + " documento(s) pendentes ou com erro de envio? (" + Math.min(linhas.length, painelXMLUtil.LIMITE_LOTE) + " por vez)", linhas);
    },

    confirmar: function (mensagem, linhas) {
        var that = this;
        var executar = function () {
            var lote = linhas.slice(0, painelXMLUtil.LIMITE_LOTE);
            that.executarLote(lote, linhas.length, "documento(s) enviado(s)", function (linha) { return that.reenviarUm(linha); });
        };
        if (typeof FLUIGC !== "undefined" && FLUIGC.message && FLUIGC.message.confirm) {
            FLUIGC.message.confirm({ message: mensagem, title: "Confirmar", labelYes: "Confirmar", labelNo: "Cancelar" }, function (resultado) {
                if (resultado) executar();
            });
        } else if (window.confirm(mensagem)) {
            executar();
        }
    },

    // Roda a funcao sobre cada linha, uma por vez (a tela mostra o andamento) e para depois de 3 falhas seguidas.
    executarLote: function (lote, totalFila, rotuloOk, funcao) {
        var that = this;
        var feitos = 0, erros = 0, seguidos = 0, ultimoErro = "";
        this.emLote = true;
        var passo = function (i) {
            if (i >= lote.length || seguidos >= 3) {
                that.emLote = false;
                that.redesenhar();
                var restam = totalFila - feitos;
                var texto = "Lote: " + feitos + " " + rotuloOk + (erros ? ", " + erros + " com erro" : "") + ". ";
                if (seguidos >= 3) texto += "Interrompido após 3 erros seguidos: " + ultimoErro + " ";
                else if (restam > 0) texto += "Restam " + restam + ": clique de novo para continuar.";
                that.aviso(texto);
                return;
            }
            that.aviso("Processando " + (i + 1) + " de " + lote.length + "...");
            setTimeout(function () {
                var r = funcao(lote[i]);
                if (r.ok) {
                    feitos++;
                    seguidos = 0;
                } else {
                    erros++;
                    seguidos++;
                    ultimoErro = r.msg;
                }
                passo(i + 1);
            }, 30);
        };
        passo(0);
    },

    // Recalcula os cartoes e a grade depois que linhas mudaram (PDF gerado, ERP reenviado), mantendo a pagina.
    redesenhar: function () {
        var pagina = this.pagina;
        this.aplicarFiltros();
        this.pagina = Math.min(pagina, this.totalPaginas());
        this.renderGrid();
    },

    // ------------------------------------------------------------------ DETALHES, EXPORTAR, COPIAR
    abrirDetalhes: function (el) {
        var U = painelXMLUtil;
        var chave = String($(el).attr("data-chave"));
        var l = this.indice[chave];
        if (!l) return;
        var ds = DatasetFactory.getDataset("ds_xf_detalhe", null, [DatasetFactory.createConstraint("CHAVE", chave, chave, ConstraintType.MUST)], null);
        var integracao = "", eventos = "";
        var linhas = ds && ds.values ? ds.values : [];
        for (var i = 0; i < linhas.length; i++) {
            var d = linhas[i];
            var tr = "<tr><td>" + U.esc(U.valor(d, "SEQ")) + "</td><td>" + U.esc(U.valor(d, "DATA")) + "</td><td>" + U.esc(U.valor(d, "STATUS")) + "</td><td>" + U.esc(U.valor(d, "TEXTO")) + "</td></tr>";
            if (U.valor(d, "SECAO") === "INTEGRACAO") integracao += tr;
            else eventos += tr;
        }
        var erp = U.rotuloErp(U.valor(l, "ERP_NOME"));
        var tabela = function (cab, corpo, vazio) {
            return corpo ? "<table class='table table-condensed table-bordered'><thead><tr>" + cab + "</tr></thead><tbody>" + corpo + "</tbody></table>" : "<p class='text-muted'>" + vazio + "</p>";
        };
        var html = "<div class='pxml-detalhes'>" +
            "<p><strong>Chave:</strong> <code>" + U.esc(chave) + "</code></p>" +
            "<p><strong>" + U.esc(U.valor(l, "TIPO")) + "</strong> " + U.esc(U.valor(l, "NUMERO")) + (U.valor(l, "SERIE") ? "/" + U.esc(U.valor(l, "SERIE")) : "") + " &middot; " + U.esc(U.valor(l, "EMITENTE")) +
            " &middot; " + U.esc(U.dataBr(U.valor(l, "EMISSAO"))) + " &middot; R$ " + U.esc(U.moeda(U.valor(l, "VALOR"))) + " &middot; " + U.esc(U.valor(l, "SITUACAO")) + "</p>" +
            "<p><strong>Integração" + (erp ? " com o " + U.esc(erp) : "") + ":</strong> " + U.selo(l) + "</p>" +
            tabela("<th>Tentativa</th><th>Data</th><th>Resultado</th><th>Retorno</th>", integracao, U.valor(l, "ERP_LIGADO") === "S" ? "Nenhuma tentativa de envio registrada." : "Este CNPJ não envia ao ERP.") +
            "<p><strong>Eventos fiscais (cancelamento, carta de correção...):</strong></p>" +
            tabela("<th>Seq.</th><th>Data</th><th>Evento</th><th>Descrição / texto</th>", eventos, "Nenhum evento registrado para este documento.") +
            "</div>";
        if (typeof FLUIGC !== "undefined" && FLUIGC.modal) {
            FLUIGC.modal({ title: "Detalhes do documento " + U.esc(U.valor(l, "NUMERO")), content: html, id: "modal-detalhes-xml-" + this.instanceId, size: "large", actions: [{ label: "Fechar", autoClose: true }] });
        } else {
            this.aviso(U.textoRetorno(ds));
        }
    },

    exportarCsv: function () {
        if (!this.filtrados.length) {
            this.aviso("Não há dados para exportar.");
            return;
        }
        var blob = new Blob([painelXMLUtil.csv(this.filtrados)], { type: "text/csv;charset=utf-8;" });
        var link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Painel_XML_" + painelXMLUtil.dataIso(new Date()) + ".csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.aviso(this.filtrados.length + " registro(s) exportados para CSV.");
    },

    copiarChave: function (el, ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        var that = this;
        var chave = String($(el).attr("data-chave") || "");
        painelXMLUtil.copiarTexto(chave,
            function () { that.aviso("Chave copiada: " + chave); },
            function () { that.aviso("Não foi possível copiar. Chave: " + chave); });
    },

    mostrarRetorno: function (ds, naAbaSync) {
        this.aviso(painelXMLUtil.textoRetorno(ds), naAbaSync);
    },

    // Mensagem da aba Documentos (padrao) ou da aba Status do Sync (naAbaSync), para nao cair numa aba escondida.
    aviso: function (texto, naAbaSync) {
        $((naAbaSync ? "#avisoSync_" : "#aviso_") + this.instanceId).text(texto);
    },

    carimbo: function () {
        $("#hora_" + this.instanceId).text(painelXMLUtil.hora());
    }
});
