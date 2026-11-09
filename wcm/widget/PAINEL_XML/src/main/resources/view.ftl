<!--
	ANALISTA RICARDO ANDRADE
	*** NAO IDENTAR ESTE CODIGO ***
	2611-P11
-->
<script>
	/* RESPONSIVO */
	$('head').append("<meta name='viewport' content='width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no' />");
</script>

<!-- CUSTOMIZADOS -->
<script type="application/javascript" src="/webdesk/vcXMLRPC.js" charset="utf-8"></script>

<#-- Preferencias da instancia entram pelo data-params (padrao SuperWidget) -->
<#assign xfPastaGed = (pastaGed!"")?js_string?html>
<#assign xfUrlParametros = (urlParametros!"")?js_string?html>

<div id="painelXML_${instanceId}"
	class="super-widget wcm-widget-class fluig-style-guide pxml-widget"
	data-params="painelXML.instance({pastaGed: '${xfPastaGed}', urlParametros: '${xfUrlParametros}'})">

	<!-- ===== HEADER BAR ===== -->
	<div class="pxml-header">
		<div class="pxml-header-brand">
			<div class="pxml-header-icon-wrap">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="28" height="28"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
			</div>
			<div class="pxml-header-text">
				<h1 class="pxml-title">Painel de XML Fiscal</h1>
				<span class="pxml-subtitle">NF-e, NFS-e, DANFE, DANFS-e, Concessionárias e CT-e &middot; 2611-P11</span>
			</div>
		</div>
		<div class="pxml-header-actions">
			<#if (urlParametros!"") != "">
			<a class="pxml-action-btn" href="${urlParametros?html}">Parâmetros</a>
			</#if>
			<span class="pxml-last-update">Última sincronização: <span id="sync_${instanceId}">--</span> &middot; Atualizado às <span id="hora_${instanceId}">--:--</span></span>
		</div>
	</div>

	<!-- ===== ABAS ===== -->
	<ul class="nav nav-tabs pxml-tabs">
		<li class="active"><a href="#" data-aba="docs">Documentos</a></li>
		<li><a href="#" data-aba="sync">Status do Sync</a></li>
	</ul>

	<!-- ===== ABA: DOCUMENTOS ===== -->
	<div class="pxml-pane active" id="pane_docs_${instanceId}">

	<!-- ===== SECAO: CONSULTA ===== -->
	<div class="pxml-section">
		<div class="pxml-section-header">
			<h2 class="pxml-section-title">Consulta de documentos</h2>
			<div class="pxml-section-tools">
				<button type="button" class="btn btn-sm btn-default" data-importar title="Importar XML ou ZIP">Importar XML</button>
				<button type="button" class="btn btn-sm btn-default" data-manifestar title="Ciência da operação (NF-e): usa o CNPJ e a chave informados abaixo">Ciência da operação</button>
				<input type="file" id="arquivos_${instanceId}" data-importar-arquivo accept=".xml,.zip" multiple style="display:none" />
			</div>
		</div>
		<div class="pxml-section-body">
			<!-- KPI CARDS: OPERACAO (clique filtra a grade) -->
			<div class="pxml-kpi-grid pxml-kpi-ops" id="kpisOp_${instanceId}"></div>
			<div class="row">
				<div class="col-sm-2 form-group"><label for="tipo_${instanceId}">Tipo</label><select class="form-control" id="tipo_${instanceId}"><option value="">Todos</option><option value="NFE">NF-e</option><option value="CTE">CT-e</option><option value="NFSE">NFS-e</option><option value="NF3E">NF3e (energia)</option><option value="NFCOM">NFCom (comunicação)</option></select></div>
				<div class="col-sm-2 form-group"><label for="cnpj_${instanceId}">CNPJ</label><input class="form-control" id="cnpj_${instanceId}" maxlength="18" placeholder="opcional" /></div>
				<div class="col-sm-2 form-group"><label for="inicio_${instanceId}">De</label><input class="form-control" id="inicio_${instanceId}" type="date" /></div>
				<div class="col-sm-2 form-group"><label for="fim_${instanceId}">Até</label><input class="form-control" id="fim_${instanceId}" type="date" /></div>
				<div class="col-sm-2 form-group"><label for="chave_${instanceId}">Chave</label><input class="form-control" id="chave_${instanceId}" /></div>
				<div class="col-sm-2 form-group"><label>&nbsp;</label><button type="button" class="btn btn-primary btn-block" data-buscar>Buscar</button></div>
			</div>
			<p id="aviso_${instanceId}" class="pxml-aviso"></p>
		</div>
	</div>

	<!-- ===== SECAO: DOCUMENTOS ===== -->
	<div class="pxml-section">
		<div class="pxml-section-header">
			<h2 class="pxml-section-title">Documentos</h2>
			<div class="pxml-section-tools">
				<button type="button" class="btn btn-sm btn-success" data-reenviar-selecionados title="Reenvia ao ERP os documentos marcados">Reenviar selecionados (<span id="contador_${instanceId}">0</span>)</button>
				<button type="button" class="btn btn-sm btn-warning" data-reenviar-massa title="Reenvia ao ERP os documentos pendentes ou com erro de envio (20 por clique)">Reenviar com falha / pendentes</button>
				<button type="button" class="btn btn-sm btn-default" data-gerar-pendentes title="Gera o DANFE, o DANFSe ou o espelho (NFS-e municipal) dos documentos filtrados que ainda não têm PDF (20 por clique)">Gerar PDFs pendentes</button>
				<button type="button" class="btn btn-sm btn-default" data-exportar title="Exporta os documentos filtrados para CSV (abre no Excel)">Exportar Excel</button>
			</div>
			<div class="pxml-section-tools pxml-section-tools-right">
				<!-- ajustar espaco/layout -->
				<label class="pxml-tamanho" for="tamanho_${instanceId}">Exibir</label>
				<select class="form-control input-sm" id="tamanho_${instanceId}" data-tamanho><option value="10">10</option><option value="25" selected>25</option><option value="50">50</option><option value="100">100</option></select>
			</div>
		</div>
		<!-- KPI CARDS: TIPO E PDF -->
		<div class="pxml-section-body pxml-kpi-bloco">
			<div class="pxml-kpi-grid" id="kpis_${instanceId}"></div>
		</div>
		<!-- FILTROS DA GRADE (no navegador) -->
		<div class="pxml-section-body pxml-filtros-bloco">
			<div class="row">
				<div class="col-sm-2 form-group"><label for="filtroStatus_${instanceId}">Situação no ERP</label><select class="form-control" id="filtroStatus_${instanceId}" data-filtro-auto><option value="">Todas</option><option value="INTEGRADO">Integrados</option><option value="PENDENTE">Pendentes de envio</option><option value="ERRO">Com erro de envio</option><option value="CANCELADO">Cancelados</option><option value="SEM_ERP">Sem envio ao ERP</option></select></div>
				<div class="col-sm-3 form-group"><label for="filtroEmitente_${instanceId}">Emitente</label><input class="form-control" id="filtroEmitente_${instanceId}" placeholder="Nome ou razão social" /></div>
				<div class="col-sm-2 form-group"><label for="filtroCnpjEmit_${instanceId}">CNPJ do emitente</label><input class="form-control" id="filtroCnpjEmit_${instanceId}" maxlength="18" /></div>
				<div class="col-sm-2 form-group"><label for="filtroNumero_${instanceId}">Número</label><input class="form-control" id="filtroNumero_${instanceId}" /></div>
				<div class="col-sm-1 form-group"><label for="filtroPdf_${instanceId}">PDF</label><select class="form-control" id="filtroPdf_${instanceId}" data-filtro-auto title="DANFE, DANFSe ou espelho"><option value="">Todos</option><option value="pendente">A gerar</option><option value="gerado">Gerados</option></select></div>
				<div class="col-sm-2 form-group"><label>&nbsp;</label><div class="btn-group btn-block"><button type="button" class="btn btn-default" style="width:60%" data-aplicar-filtros>Filtrar</button><button type="button" class="btn btn-default" style="width:40%" data-limpar-filtros title="Limpar os filtros">Limpar</button></div></div>
			</div>
		</div>
		<div class="table-responsive">
			<table class="table table-condensed table-hover pxml-table">
				<thead><tr><th class="text-center"><input type="checkbox" id="selTodos_${instanceId}" data-selecionar-todos title="Selecionar todos da página" /></th><th>Tipo</th><th>Chave</th><th>Número</th><th>Emitente</th><th>CNPJ emitente</th><th>Emissão</th><th class="text-right">Valor</th><th>Situação</th><th>Origem</th><th>ERP</th><th>Autenticidade</th><th></th></tr></thead>
				<tbody id="grade_${instanceId}"></tbody>
			</table>
		</div>
		<div class="pxml-paginacao">
			<span id="paginacaoTexto_${instanceId}" class="pxml-aviso"></span>
			<ul class="pagination pagination-sm" id="paginacao_${instanceId}"></ul>
		</div>
	</div>

	</div>

	<!-- ===== ABA: STATUS DO SYNC ===== -->
	<div class="pxml-pane" id="pane_sync_${instanceId}">
	<div class="pxml-section">
		<div class="pxml-section-header">
			<h2 class="pxml-section-title">Status do sync</h2>
			<div class="pxml-section-tools">
				<button type="button" class="btn btn-sm btn-default" data-atualizar title="Atualizar o status do sync">Atualizar</button>
				<button type="button" class="btn btn-sm btn-primary" data-sync title="Sincronizar agora">Sincronizar</button>
			</div>
		</div>
		<div class="pxml-section-body"><p id="avisoSync_${instanceId}" class="pxml-aviso"></p></div>
		<div class="table-responsive">
			<table class="table table-condensed pxml-table">
				<thead><tr><th>CNPJ</th><th>Tipo</th><th>Situação</th><th>Última execução ok</th><th>Dias</th><th>Último NSU</th><th>Novos</th><th>cStat</th><th>Próxima consulta</th><th>Erro</th></tr></thead>
				<tbody id="status_${instanceId}"></tbody>
			</table>
		</div>
	</div>
	</div>
</div>
