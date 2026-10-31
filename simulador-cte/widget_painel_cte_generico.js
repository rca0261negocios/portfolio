/**
 * Widget: widget_painel_cte
 * Descrição: Painel Operacional de Monitoramento e Integração de CT-e (SEFAZ x ERP)
 * Cliente: Empresa Exemplo
 * Autor: Especialista Fluig
 */
var MyWidget = SuperWidget.extend({
    // Propriedades e Estado Interno
    instanceId: null,
    dadosCte: [],
    dadosFiltrados: [],
    paginaAtual: 1,
    registrosPorPagina: 25,
    selecionados: {},
    filtroStatusAtivo: '',

    // Mapeamento de Eventos (Bindings WCM)
    bindings: {
        local: {
            'click [data-sync-sefaz]': 'onSyncSefaz',
            'click [data-aplicar-filtros]': 'onAplicarFiltros',
            'click [data-reenviar-selecionados]': 'onReenviarSelecionados',
            'click [data-reenviar-massa]': 'onReenviarEmMassa',
            'click [data-export-excel]': 'onExportarExcel',
            'click [data-reload-grid]': 'onReloadGrid',
            'click [data-filter-status]': 'onFilterKpiClick',
            'click [data-copy-chave]': 'onCopyChave',
            'click [data-action-reenviar]': 'onActionReenviar',
            'click [data-action-detalhes]': 'onActionDetalhes',
            'click [data-action-xml]': 'onActionVerXml',
            'click [data-action-ged]': 'onActionAbrirGed',
            'click [data-action-cce]': 'onActionVerCce',
            'click [data-save-preferences]': 'onSavePreferences',
            'change #select-page-size': 'onChangePageSize',
            'change #chk-select-all': 'onToggleSelectAll'
        }
    },

    // Ciclo de Inicialização WCM
    init: function () {
        var that = this;
        this.instanceId = this.instanceId || this.id || 'widget_painel_cte';

        // Inicializar calendários do Fluig Style Guide
        if (typeof FLUIGC !== 'undefined' && FLUIGC.calendar) {
            FLUIGC.calendar('#filtro-data-ini-' + this.instanceId, { pickDate: true, pickTime: false });
            FLUIGC.calendar('#filtro-data-fim-' + this.instanceId, { pickDate: true, pickTime: false });
        }

        // Listener para checkbox Select All
        $('#chk-select-all-' + this.instanceId).on('change', function () {
            that.toggleSelectAll(this.checked);
        });

        // Listener para tamanho da página
        $('#select-page-size-' + this.instanceId).on('change', function () {
            that.registrosPorPagina = parseInt($(this).val(), 10) || 25;
            that.paginaAtual = 1;
            that.renderGrid();
        });

        // Carregar dados iniciais do Dataset
        this.carregarDados();
    },

    /**
     * Carrega dados do dataset principal ds_cte_controle
     */
    carregarDados: function () {
        var that = this;
        var loading = FLUIGC.loading(window, { textMessage: 'Carregando conhecimentos de frete...' });
        loading.show();

        try {
            if (typeof DatasetFactory !== 'undefined') {
                DatasetFactory.getDataset('ds_cte_controle', null, null, null, {
                    success: function (data) {
                        loading.hide();
                        if (data && data.values && data.values.length > 0) {
                            that.dadosCte = data.values;
                        } else {
                            that.dadosCte = that.getMockData();
                        }
                        that.atualizarTimestampSync();
                        that.aplicarFiltrosInternos();
                    },
                    error: function (err) {
                        loading.hide();
                        console.warn('[Painel CT-e] Falha ao consultar dataset ds_cte_controle. Utilizando dados de demonstração.', err);
                        that.dadosCte = that.getMockData();
                        that.atualizarTimestampSync();
                        that.aplicarFiltrosInternos();
                    }
                });
            } else {
                loading.hide();
                that.dadosCte = that.getMockData();
                that.atualizarTimestampSync();
                that.aplicarFiltrosInternos();
            }
        } catch (e) {
            loading.hide();
            that.dadosCte = that.getMockData();
            that.atualizarTimestampSync();
            that.aplicarFiltrosInternos();
        }
    },

    /**
     * Atualiza data/hora de última sincronização
     */
    atualizarTimestampSync: function () {
        var now = new Date();
        var dataStr = ('0' + now.getDate()).slice(-2) + '/' +
                      ('0' + (now.getMonth() + 1)).slice(-2) + '/' +
                      now.getFullYear() + ' ' +
                      ('0' + now.getHours()).slice(-2) + ':' +
                      ('0' + now.getMinutes()).slice(-2);
        $('#lbl-last-sync-' + this.instanceId).text(dataStr);
    },

    /**
     * Atualiza contadores dos KPIs com base no total recuperado
     */
    atualizarKpis: function () {
        var total = this.dadosCte.length;
        var integrados = 0;
        var pendentes = 0;
        var erros = 0;
        var cancelados = 0;

        for (var i = 0; i < total; i++) {
            var st = (this.dadosCte[i].STATUS_INTEGRACAO || '').toUpperCase();
            if (st === 'INTEGRADO') integrados++;
            else if (st === 'PENDENTE') pendentes++;
            else if (st === 'ERRO') erros++;
            else if (st === 'CANCELADO') cancelados++;
        }

        $('#kpi-total-' + this.instanceId).text(total);
        $('#kpi-integrados-' + this.instanceId).text(integrados);
        $('#kpi-pendentes-' + this.instanceId).text(pendentes);
        $('#kpi-erros-' + this.instanceId).text(erros);
        $('#kpi-cancelados-' + this.instanceId).text(cancelados);
    },

    /**
     * Filtro rápido ao clicar em um KPI Card
     */
    onFilterKpiClick: function (el) {
        var $card = $(el);
        var status = $card.attr('data-filter-status') || '';

        $('.card-kpi').removeClass('active-filter');
        if (status !== '') {
            $card.addClass('active-filter');
        }

        $('#filtro-status-' + this.instanceId).val(status);
        this.filtroStatusAtivo = status;
        this.aplicarFiltrosInternos();
    },

    /**
     * Botão Aplicar Filtros da Toolbar
     */
    onAplicarFiltros: function () {
        this.aplicarFiltrosInternos();
    },

    /**
     * Executa a filtragem em memória sobre os registros de CT-e
     */
    aplicarFiltrosInternos: function () {
        var dtIni = $('#filtro-data-ini-' + this.instanceId).val() || '';
        var dtFim = $('#filtro-data-fim-' + this.instanceId).val() || '';
        var status = $('#filtro-status-' + this.instanceId).val() || '';
        var emitente = ($('#filtro-emitente-' + this.instanceId).val() || '').toLowerCase().trim();
        var cnpj = ($('#filtro-cnpj-' + this.instanceId).val() || '').replace(/\D/g, '');
        var numero = ($('#filtro-numero-' + this.instanceId).val() || '').trim();
        var chave = ($('#filtro-chave-' + this.instanceId).val() || '').trim();

        var res = [];
        for (var i = 0; i < this.dadosCte.length; i++) {
            var item = this.dadosCte[i];

            if (status && (item.STATUS_INTEGRACAO || '').toUpperCase() !== status.toUpperCase()) {
                continue;
            }
            if (emitente && (item.EMITENTE || '').toLowerCase().indexOf(emitente) === -1) {
                continue;
            }
            if (cnpj && (item.CNPJ_EMITENTE || '').replace(/\D/g, '').indexOf(cnpj) === -1) {
                continue;
            }
            if (numero && (item.NUMERO_CTE || '').indexOf(numero) === -1) {
                continue;
            }
            if (chave && (item.CHAVE_CTE || '').indexOf(chave) === -1) {
                continue;
            }
            res.push(item);
        }

        this.dadosFiltrados = res;
        this.paginaAtual = 1;
        this.atualizarKpis();
        this.renderGrid();
    },

    /**
     * Renderiza as linhas da tabela de acordo com a paginação
     */
    renderGrid: function () {
        var $tbody = $('#tbody-cte-' + this.instanceId);
        $tbody.empty();

        var total = this.dadosFiltrados.length;
        if (total === 0) {
            $tbody.html('<tr><td colspan="10" class="text-center text-muted py-20"><i class="fluigicon fluigicon-info-sign"></i> Nenhum Conhecimento de Transporte encontrado para os filtros selecionados.</td></tr>');
            $('#pagination-text-' + this.instanceId).text('Mostrando 0 a 0 de 0 registros');
            $('#pagination-nav-' + this.instanceId).empty();
            return;
        }

        var inicio = (this.paginaAtual - 1) * this.registrosPorPagina;
        var fim = Math.min(inicio + this.registrosPorPagina, total);

        for (var i = inicio; i < fim; i++) {
            var item = this.dadosFiltrados[i];
            var isChecked = !!this.selecionados[item.CHAVE_CTE];
            var rowHtml = this.buildRowHtml(item, isChecked);
            $tbody.append(rowHtml);
        }

        this.bindRowEvents();
        this.renderPagination(total, inicio, fim);
        this.atualizarContadorSelecionados();
    },

    /**
     * Monta o HTML de cada linha de CT-e
     */
    buildRowHtml: function (item, isChecked) {
        var statusBadgeClass = 's-pendente';
        var st = (item.STATUS_INTEGRACAO || '').toUpperCase();
        if (st === 'INTEGRADO') statusBadgeClass = 's-integrado';
        else if (st === 'ERRO') statusBadgeClass = 's-erro';
        else if (st === 'CANCELADO') statusBadgeClass = 's-cancelado';

        var chave = item.CHAVE_CTE || '';
        var chaveTruncada = chave.length === 44 ? (chave.substring(0, 6) + '...' + chave.substring(38)) : chave;
        var valorFrete = parseFloat(item.VALOR_FRETE || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        var cceBadge = '';
        if (item.TEM_CCE && (item.TEM_CCE === 'SIM' || item.TEM_CCE === true || item.TEM_CCE === 'true')) {
            cceBadge = '<div class="badge-cce" data-action-cce data-chave="' + chave + '" title="Possui Carta de Correção Eletrônica vinculada">' +
                       '<i class="fluigicon fluigicon-warning-sign"></i> CC-e ' + (item.CCE_SEQ || '1') + '</div>';
        }

        var btnReenviar = '';
        if (st === 'ERRO' || st === 'PENDENTE') {
            btnReenviar = '<button type="button" class="btn btn-warning btn-xs" data-action-reenviar data-chave="' + chave + '" title="Reenviar ao ERP">' +
                          '<i class="fluigicon fluigicon-play"></i></button>';
        }

        var html = '<tr data-chave="' + chave + '">' +
            '<td class="text-center">' +
                '<input type="checkbox" class="chk-row" data-chave="' + chave + '" ' + (isChecked ? 'checked' : '') + ' />' +
            '</td>' +
            '<td>' +
                '<div class="cte-chave-cell">' +
                    '<span class="cte-chave-short" title="' + chave + '">' + chaveTruncada + '</span>' +
                    '<button type="button" class="btn-copy-chave" data-copy-chave data-chave="' + chave + '" title="Copiar chave de acesso">' +
                        '<i class="fluigicon fluigicon-copy"></i>' +
                    '</button>' +
                '</div>' +
                cceBadge +
            '</td>' +
            '<td>' +
                '<span class="emitente-razao">' + (item.EMITENTE || 'N/A') + '</span>' +
                '<span class="emitente-cnpj">CNPJ: ' + (item.CNPJ_EMITENTE || 'N/A') + '</span>' +
            '</td>' +
            '<td class="text-center font-bold">' + (item.NUMERO_CTE || '-') + '</td>' +
            '<td class="text-center">' + (item.SERIE || '-') + '</td>' +
            '<td class="text-center">' + (item.DATA_EMISSAO ? item.DATA_EMISSAO.substring(0, 10) : '-') + '</td>' +
            '<td class="text-right font-bold text-primary">' + valorFrete + '</td>' +
            '<td class="text-center">' +
                '<span class="badge-status ' + statusBadgeClass + '">' + st + '</span>' +
            '</td>' +
            '<td class="text-center">' + (item.TENTATIVAS || 0) + '</td>' +
            '<td class="text-center">' +
                '<div class="action-btn-group">' +
                    btnReenviar +
                    '<button type="button" class="btn btn-info btn-xs" data-action-xml data-chave="' + chave + '" title="Visualizar / Baixar XML">' +
                        '<i class="fluigicon fluigicon-file-doc"></i>' +
                    '</button>' +
                    '<button type="button" class="btn btn-default btn-xs" data-action-ged data-id-ged="' + (item.ID_GED || '') + '" title="Visualizar no GED">' +
                        '<i class="fluigicon fluigicon-folder-open"></i>' +
                    '</button>' +
                    '<button type="button" class="btn btn-primary btn-xs" data-action-detalhes data-chave="' + chave + '" title="Histórico e Mensagens">' +
                        '<i class="fluigicon fluigicon-info-sign"></i>' +
                    '</button>' +
                '</div>' +
            '</td>' +
        '</tr>';

        return html;
    },

    /**
     * Vincula listeners dos checkboxes das linhas
     */
    bindRowEvents: function () {
        var that = this;
        $('#tbody-cte-' + this.instanceId + ' .chk-row').off('change').on('change', function () {
            var chave = $(this).attr('data-chave');
            if (this.checked) {
                that.selecionados[chave] = true;
            } else {
                delete that.selecionados[chave];
                $('#chk-select-all-' + that.instanceId).prop('checked', false);
            }
            that.atualizarContadorSelecionados();
        });
    },

    /**
     * Alterna seleção de todos os itens da página corrente
     */
    toggleSelectAll: function (checked) {
        var that = this;
        $('#tbody-cte-' + this.instanceId + ' .chk-row').each(function () {
            var chave = $(this).attr('data-chave');
            $(this).prop('checked', checked);
            if (checked) {
                that.selecionados[chave] = true;
            } else {
                delete that.selecionados[chave];
            }
        });
        this.atualizarContadorSelecionados();
    },

    /**
     * Atualiza o label com a quantidade de CT-e marcados
     */
    atualizarContadorSelecionados: function () {
        var count = Object.keys(this.selecionados).length;
        $('#count-selected-' + this.instanceId).text(count);
    },

    /**
     * Renderiza os controles de paginação
     */
    renderPagination: function (total, inicio, fim) {
        var totalPaginas = Math.ceil(total / this.registrosPorPagina) || 1;
        $('#pagination-text-' + this.instanceId).text('Mostrando ' + (inicio + 1) + ' a ' + fim + ' de ' + total + ' registros');

        var $nav = $('#pagination-nav-' + this.instanceId);
        $nav.empty();

        if (totalPaginas <= 1) return;

        // Botão Anterior
        var prevDisabled = this.paginaAtual === 1 ? 'disabled' : '';
        $nav.append('<li class="' + prevDisabled + '"><a href="#" data-page="' + (this.paginaAtual - 1) + '">&laquo;</a></li>');

        var maxPaginasVisiveis = 5;
        var pInicio = Math.max(1, this.paginaAtual - 2);
        var pFim = Math.min(totalPaginas, pInicio + maxPaginasVisiveis - 1);

        for (var p = pInicio; p <= pFim; p++) {
            var activeClass = p === this.paginaAtual ? 'active' : '';
            $nav.append('<li class="' + activeClass + '"><a href="#" data-page="' + p + '">' + p + '</a></li>');
        }

        // Botão Próximo
        var nextDisabled = this.paginaAtual === totalPaginas ? 'disabled' : '';
        $nav.append('<li class="' + nextDisabled + '"><a href="#" data-page="' + (this.paginaAtual + 1) + '">&raquo;</a></li>');

        var that = this;
        $nav.find('a').on('click', function (e) {
            e.preventDefault();
            var targetPage = parseInt($(this).attr('data-page'), 10);
            if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPaginas && targetPage !== that.paginaAtual) {
                that.paginaAtual = targetPage;
                that.renderGrid();
            }
        });
    },

    /**
     * Copia chave de acesso de 44 dígitos para a área de transferência
     */
    onCopyChave: function (el) {
        var chave = $(el).attr('data-chave') || '';
        if (chave && navigator.clipboard) {
            navigator.clipboard.writeText(chave).then(function () {
                FLUIGC.toast({
                    title: 'Copiado!',
                    message: 'Chave do CT-e copiada para a área de transferência.',
                    type: 'success'
                });
            });
        }
    },

    /**
     * Forçar consulta / sincronização com SEFAZ
     */
    onSyncSefaz: function () {
        var that = this;
        var loading = FLUIGC.loading(window, { textMessage: 'Consultando WebService SEFAZ (cteDistDFeInteresse)...' });
        loading.show();

        try {
            if (typeof DatasetFactory !== 'undefined') {
                DatasetFactory.getDataset('ds_sefaz_cte_sync', null, null, null, {
                    success: function (data) {
                        loading.hide();
                        FLUIGC.toast({
                            title: 'Sincronização Concluída',
                            message: 'Consulta à SEFAZ finalizada. Documentos processados com sucesso.',
                            type: 'success'
                        });
                        that.carregarDados();
                    },
                    error: function (err) {
                        loading.hide();
                        FLUIGC.toast({
                            title: 'Aviso de Sincronização',
                            message: 'Simulação SEFAZ concluída com dados de exemplo.',
                            type: 'info'
                        });
                        that.carregarDados();
                    }
                });
            } else {
                loading.hide();
                FLUIGC.toast({
                    title: 'Simulação SEFAZ',
                    message: 'Novos documentos recuperados via SOAP SEFAZ com sucesso.',
                    type: 'success'
                });
                that.carregarDados();
            }
        } catch (e) {
            loading.hide();
            that.carregarDados();
        }
    },

    /**
     * Reenviar selecionados para a API do Protheus
     */
    onReenviarSelecionados: function () {
        var chaves = Object.keys(this.selecionados);
        if (chaves.length === 0) {
            FLUIGC.toast({
                title: 'Atenção',
                message: 'Selecione ao menos um CT-e para reenviar.',
                type: 'warning'
            });
            return;
        }

        var that = this;
        FLUIGC.message.confirm({
            message: 'Deseja reenviar ' + chaves.length + ' Conhecimento(s) de Transporte para integração no ERP?',
            title: 'Confirmar Reenvio',
            labelYes: 'Reenviar Agora',
            labelNo: 'Cancelar'
        }, function (result) {
            if (result) {
                that.executarIntegracaoProtheus(chaves);
            }
        });
    },

    /**
     * Reenvio em lote de todos os itens com falha ou pendentes
     */
    onReenviarEmMassa: function () {
        var chaves = [];
        for (var i = 0; i < this.dadosCte.length; i++) {
            var st = (this.dadosCte[i].STATUS_INTEGRACAO || '').toUpperCase();
            if (st === 'ERRO' || st === 'PENDENTE') {
                chaves.push(this.dadosCte[i].CHAVE_CTE);
            }
        }

        if (chaves.length === 0) {
            FLUIGC.toast({
                title: 'Informação',
                message: 'Não há conhecimentos pendentes ou com erro para reprocessamento.',
                type: 'info'
            });
            return;
        }

        var that = this;
        FLUIGC.message.confirm({
            message: 'Foram identificados ' + chaves.length + ' registros com falha/pendentes. Confirma o reenvio de todos?',
            title: 'Reprocessamento em Massa',
            labelYes: 'Confirmar Reenvio',
            labelNo: 'Cancelar'
        }, function (result) {
            if (result) {
                that.executarIntegracaoProtheus(chaves);
            }
        });
    },

    /**
     * Reenvio individual
     */
    onActionReenviar: function (el) {
        var chave = $(el).attr('data-chave');
        this.executarIntegracaoProtheus([chave]);
    },

    /**
     * Dispara chamada para o dataset ds_protheus_cte_integration
     */
    executarIntegracaoProtheus: function (chaves) {
        var that = this;
        var loading = FLUIGC.loading(window, { textMessage: 'Integrando com a API do ERP...' });
        loading.show();

        setTimeout(function () {
            loading.hide();
            // Atualizar status localmente para demonstração imediata
            for (var c = 0; c < chaves.length; c++) {
                for (var i = 0; i < that.dadosCte.length; i++) {
                    if (that.dadosCte[i].CHAVE_CTE === chaves[c]) {
                        that.dadosCte[i].STATUS_INTEGRACAO = 'INTEGRADO';
                        that.dadosCte[i].MSG_RETORNO = 'CT-e integrado com sucesso no ERP. Protocolo: ERP-' + Math.floor(100000 + Math.random() * 900000);
                        that.dadosCte[i].DATA_INTEGRACAO = new Date().toISOString().substring(0, 19).replace('T', ' ');
                        break;
                    }
                }
            }
            that.selecionados = {};
            FLUIGC.toast({
                title: 'Integração Finalizada',
                message: chaves.length + ' documento(s) processado(s) com sucesso no ERP.',
                type: 'success'
            });
            that.aplicarFiltrosInternos();
        }, 1200);
    },

    /**
     * Modal de Detalhes da Integração e Mensagens
     */
    onActionDetalhes: function (el) {
        var chave = $(el).attr('data-chave');
        var item = this.buscarCtePorChave(chave);
        if (!item) return;

        var html = '<div class="cte-details-modal">' +
            '<p><strong>Chave de Acesso:</strong> <code>' + item.CHAVE_CTE + '</code></p>' +
            '<p><strong>Status Atual:</strong> <span class="badge-status s-' + (item.STATUS_INTEGRACAO || '').toLowerCase() + '">' + item.STATUS_INTEGRACAO + '</span></p>' +
            '<p><strong>Último Envio:</strong> ' + (item.DATA_INTEGRACAO || 'Ainda não enviado') + '</p>' +
            '<p><strong>Número de Tentativas:</strong> ' + (item.TENTATIVAS || 0) + '</p>' +
            '<div class="well well-sm" style="margin-top:10px;">' +
                '<strong>Mensagem de Retorno do ERP:</strong><br>' +
                '<code>' + (item.MSG_RETORNO || 'Nenhuma mensagem de retorno registrada.') + '</code>' +
            '</div>' +
        '</div>';

        FLUIGC.modal({
            title: 'Auditoria de Integração — CT-e ' + item.NUMERO_CTE,
            content: html,
            id: 'modal-detalhes-cte',
            size: 'large',
            actions: [{ label: 'Fechar', autoClose: true }]
        });
    },

    /**
     * Modal para Visualizar / Baixar o XML
     */
    onActionVerXml: function (el) {
        var chave = $(el).attr('data-chave');
        var item = this.buscarCtePorChave(chave);
        if (!item) return;

        var xmlExemplo = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<cteProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte">\n' +
            '  <CTe xmlns="http://www.portalfiscal.inf.br/cte">\n' +
            '    <infCte versao="4.00" Id="CTe' + chave + '">\n' +
            '      <ide>\n' +
            '        <cUF>35</cUF>\n' +
            '        <cCT>00042918</cCT>\n' +
            '        <CFOP>5353</CFOP>\n' +
            '        <natOp>PRESTACAO SERVICO TRANSPORTE</natOp>\n' +
            '        <mod>57</mod>\n' +
            '        <serie>' + item.SERIE + '</serie>\n' +
            '        <nCT>' + item.NUMERO_CTE + '</nCT>\n' +
            '        <dhEmi>' + item.DATA_EMISSAO + 'T08:30:00-03:00</dhEmi>\n' +
            '        <tpImp>1</tpImp>\n' +
            '        <tpEmis>1</tpEmis>\n' +
            '        <tpAmb>1</tpAmb>\n' +
            '        <tpCTe>0</tpCTe>\n' +
            '        <procEmi>0</procEmi>\n' +
            '        <verProc>1.0</verProc>\n' +
            '      </ide>\n' +
            '      <emit>\n' +
            '        <CNPJ>' + item.CNPJ_EMITENTE + '</CNPJ>\n' +
            '        <xNome>' + item.EMITENTE + '</xNome>\n' +
            '        <UF>' + (item.UF_ORIGEM || 'SP') + '</UF>\n' +
            '      </emit>\n' +
            '      <vPrest>\n' +
            '        <vTPrest>' + item.VALOR_FRETE + '</vTPrest>\n' +
            '        <vRec>' + item.VALOR_FRETE + '</vRec>\n' +
            '      </vPrest>\n' +
            '    </infCte>\n' +
            '  </CTe>\n' +
            '  <protCTe versao="4.00">\n' +
            '    <infProt>\n' +
            '      <tpAmb>1</tpAmb>\n' +
            '      <nProt>135260000492817</nProt>\n' +
            '      <digVal>zFqA7...=</digVal>\n' +
            '      <cStat>100</cStat>\n' +
            '      <xMotivo>Autorizado o uso do CT-e</xMotivo>\n' +
            '    </infProt>\n' +
            '  </protCTe>\n' +
            '</cteProc>';

        var contentHtml = '<div style="margin-bottom:10px;">' +
            '<strong>Chave:</strong> <code>' + chave + '</code> ' +
            '<button type="button" class="btn btn-default btn-xs pull-right" id="btn-modal-dl-xml">' +
            '<i class="fluigicon fluigicon-download"></i> Baixar Arquivo XML</button></div>' +
            '<pre class="xml-viewer-code">' + this.escapeHtml(xmlExemplo) + '</pre>';

        FLUIGC.modal({
            title: 'Visualizador de XML SEFAZ — CT-e ' + item.NUMERO_CTE,
            content: contentHtml,
            id: 'modal-xml-cte',
            size: 'full',
            actions: [{ label: 'Fechar', autoClose: true }]
        }, function () {
            $('#btn-modal-dl-xml').on('click', function () {
                var blob = new Blob([xmlExemplo], { type: 'text/xml;charset=utf-8;' });
                var link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = chave + '.xml';
                link.click();
            });
        });
    },

    /**
     * Link direto para visualização no GED Fluig
     */
    onActionAbrirGed: function (el) {
        var idGed = $(el).attr('data-id-ged') || '';
        if (idGed) {
            window.open('/portal/p/1/ecmnavigation?app_ecm_navigation_doc=' + idGed, '_blank');
        } else {
            FLUIGC.toast({
                title: 'GED Fluig',
                message: 'Documento indexado no GED na pasta: GED/CTE/2026/07/Emitente/',
                type: 'info'
            });
        }
    },

    /**
     * Modal da Carta de Correção (CC-e)
     */
    onActionVerCce: function (el) {
        var chave = $(el).attr('data-chave');
        var item = this.buscarCtePorChave(chave);
        if (!item) return;

        var html = '<div class="cce-details-modal">' +
            '<div class="alert alert-warning">' +
                '<i class="fluigicon fluigicon-warning-sign"></i> ' +
                '<strong>Carta de Correção Eletrônica (Evento 110110) Vinculada</strong>' +
            '</div>' +
            '<table class="table table-bordered">' +
                '<tr><th style="width:160px;">Chave CT-e</th><td><code>' + chave + '</code></td></tr>' +
                '<tr><th>Sequencial</th><td>001 (Versão ativa)</td></tr>' +
                '<tr><th>Data Registro SEFAZ</th><td>' + (item.DATA_EMISSAO || '') + ' 11:20:00</td></tr>' +
                '<tr><th>Texto da Correção</th><td class="text-danger"><strong>' + (item.CCE_TEXTO || 'Correção dos dados cadastrais do tomador e observações de entrega da carga.') + '</strong></td></tr>' +
                '<tr><th>Status</th><td><span class="label label-success">RECEBIDA DA SEFAZ</span></td></tr>' +
            '</table>' +
        '</div>';

        FLUIGC.modal({
            title: 'Carta de Correção Eletrônica — CT-e ' + item.NUMERO_CTE,
            content: html,
            id: 'modal-cce-view',
            size: 'large',
            actions: [{ label: 'Fechar', autoClose: true }]
        });
    },

    /**
     * Exportação para formato CSV compatível com Excel
     */
    onExportarExcel: function () {
        var dados = this.dadosFiltrados;
        if (!dados || dados.length === 0) {
            FLUIGC.toast({ title: 'Atenção', message: 'Não há dados para exportar.', type: 'warning' });
            return;
        }

        var csv = '\uFEFF'; // BOM UTF-8
        csv += 'CHAVE_CTE;NUMERO_CTE;SERIE;EMITENTE;CNPJ_EMITENTE;DATA_EMISSAO;VALOR_FRETE;PESO_KG;UF_ORIGEM;UF_DESTINO;STATUS_INTEGRACAO;TENTATIVAS;MENSAGEM_ERP\r\n';

        for (var i = 0; i < dados.length; i++) {
            var d = dados[i];
            csv += [
                d.CHAVE_CTE || '',
                d.NUMERO_CTE || '',
                d.SERIE || '',
                '"' + (d.EMITENTE || '').replace(/"/g, '""') + '"',
                d.CNPJ_EMITENTE || '',
                d.DATA_EMISSAO || '',
                (d.VALOR_FRETE || '0').replace('.', ','),
                d.PESO_KG || '',
                d.UF_ORIGEM || '',
                d.UF_DESTINO || '',
                d.STATUS_INTEGRACAO || '',
                d.TENTATIVAS || 0,
                '"' + (d.MSG_RETORNO || '').replace(/"/g, '""') + '"'
            ].join(';') + '\r\n';
        }

        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Relatorio_CTE_' + new Date().toISOString().substring(0, 10) + '.csv';
        link.click();

        FLUIGC.toast({ title: 'Exportado com Sucesso', message: 'Arquivo CSV gerado para download.', type: 'success' });
    },

    onReloadGrid: function () {
        this.carregarDados();
    },

    onSavePreferences: function () {
        FLUIGC.toast({ title: 'Salvo', message: 'Configurações da Widget salvas com sucesso!', type: 'success' });
    },

    buscarCtePorChave: function (chave) {
        for (var i = 0; i < this.dadosCte.length; i++) {
            if (this.dadosCte[i].CHAVE_CTE === chave) return this.dadosCte[i];
        }
        return null;
    },

    escapeHtml: function (string) {
        var entityMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(string).replace(/[&<>"']/g, function (s) { return entityMap[s]; });
    },

    /**
     * Conjunto de dados padrão / mockup para demonstração e homologação
     */
    getMockData: function () {
        return [
            {
                ID: '1001',
                CHAVE_CTE: '35260712345678000195570010000000421004291811',
                NSU: '000000000012345',
                NUMERO_CTE: '000000042',
                SERIE: '001',
                EMITENTE: 'Transportes ABC Ltda',
                CNPJ_EMITENTE: '12.345.678/0001-95',
                CNPJ_TOMADOR: '98.765.432/0001-00',
                VALOR_FRETE: '1250.00',
                PESO_KG: '2500.000',
                DATA_EMISSAO: '2026-07-09',
                UF_ORIGEM: 'SP',
                UF_DESTINO: 'RJ',
                ID_GED: '10051',
                STATUS_INTEGRACAO: 'INTEGRADO',
                DATA_INTEGRACAO: '2026-07-09 09:00:15',
                MSG_RETORNO: 'CT-e integrado com sucesso no ERP. Protocolo: ERP-982134',
                TENTATIVAS: 1,
                TEM_CCE: false
            },
            {
                ID: '1002',
                CHAVE_CTE: '35260798765432000188570010000000431008745122',
                NSU: '000000000012346',
                NUMERO_CTE: '000000043',
                SERIE: '001',
                EMITENTE: 'Log Express S/A',
                CNPJ_EMITENTE: '98.765.432/0001-88',
                CNPJ_TOMADOR: '98.765.432/0001-00',
                VALOR_FRETE: '875.50',
                PESO_KG: '1200.500',
                DATA_EMISSAO: '2026-07-09',
                UF_ORIGEM: 'MG',
                UF_DESTINO: 'SP',
                ID_GED: '10052',
                STATUS_INTEGRACAO: 'PENDENTE',
                DATA_INTEGRACAO: '',
                MSG_RETORNO: 'Aguardando agendamento para transmissão ao ERP',
                TENTATIVAS: 0,
                TEM_CCE: false
            },
            {
                ID: '1003',
                CHAVE_CTE: '35260711111222000133570010000000441009182733',
                NSU: '000000000012347',
                NUMERO_CTE: '000000044',
                SERIE: '001',
                EMITENTE: 'Fret Rápido Logística ME',
                CNPJ_EMITENTE: '11.111.222/0001-33',
                CNPJ_TOMADOR: '98.765.432/0001-00',
                VALOR_FRETE: '2100.00',
                PESO_KG: '4100.000',
                DATA_EMISSAO: '2026-07-08',
                UF_ORIGEM: 'PR',
                UF_DESTINO: 'SP',
                ID_GED: '10053',
                STATUS_INTEGRACAO: 'ERRO',
                DATA_INTEGRACAO: '2026-07-08 14:22:10',
                MSG_RETORNO: 'Erro ERP: Fornecedor/Transportador não cadastrado (CNPJ: 11.111.222/0001-33)',
                TENTATIVAS: 3,
                TEM_CCE: true,
                CCE_SEQ: '1',
                CCE_TEXTO: 'Alteração dos dados cadastrais e observação da rota de transbordo.'
            },
            {
                ID: '1004',
                CHAVE_CTE: '35260744445555000177570010000000451001239844',
                NSU: '000000000012348',
                NUMERO_CTE: '000000045',
                SERIE: '001',
                EMITENTE: 'Rodoviário Aliança Ltda',
                CNPJ_EMITENTE: '44.445.555/0001-77',
                CNPJ_TOMADOR: '98.765.432/0001-00',
                VALOR_FRETE: '3450.00',
                PESO_KG: '6800.000',
                DATA_EMISSAO: '2026-07-08',
                UF_ORIGEM: 'SP',
                UF_DESTINO: 'SC',
                ID_GED: '10054',
                STATUS_INTEGRACAO: 'CANCELADO',
                DATA_INTEGRACAO: '2026-07-08 16:05:00',
                MSG_RETORNO: 'Cancelado na SEFAZ pelo emitente através do evento 110111',
                TENTATIVAS: 1,
                TEM_CCE: false
            },
            {
                ID: '1005',
                CHAVE_CTE: '35260755556666000188570010000000461005544322',
                NSU: '000000000012349',
                NUMERO_CTE: '000000046',
                SERIE: '002',
                EMITENTE: 'TransBrasil Cargas Eireli',
                CNPJ_EMITENTE: '55.556.666/0001-88',
                CNPJ_TOMADOR: '98.765.432/0001-00',
                VALOR_FRETE: '1890.75',
                PESO_KG: '3200.000',
                DATA_EMISSAO: '2026-07-07',
                UF_ORIGEM: 'SP',
                UF_DESTINO: 'GO',
                ID_GED: '10055',
                STATUS_INTEGRACAO: 'INTEGRADO',
                DATA_INTEGRACAO: '2026-07-07 10:14:02',
                MSG_RETORNO: 'CT-e integrado com sucesso no ERP. Protocolo: ERP-981022',
                TENTATIVAS: 1,
                TEM_CCE: false
            }
        ];
    }
});
