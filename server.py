"""
CoinShare - API Flask com Banco de Dados SQLite Local
Projeto Integrador II - CoinShare
Tabelas e Atributos em Português conforme especificação do projeto
"""

import os
import sqlite3
import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

DIRETORIO_BASE = os.path.dirname(os.path.abspath(__file__))
CAMINHO_BANCO = os.path.join(DIRETORIO_BASE, "coinshare.db")

app = Flask(__name__, static_folder=DIRETORIO_BASE, static_url_path="")
CORS(app)

def obter_conexao_banco():
    """Cria e retorna uma conexão com o banco de dados SQLite."""
    conexao = sqlite3.connect(CAMINHO_BANCO)
    conexao.row_factory = sqlite3.Row
    conexao.execute("PRAGMA foreign_keys = ON;")
    return conexao

def inicializar_banco():
    """Inicializa as tabelas do banco de dados com nomes e colunas em português."""
    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    # 1. Tabela de Usuários
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha_hash TEXT NOT NULL,
        telefone TEXT DEFAULT '',
        chave_pix TEXT DEFAULT '',
        modo_escuro INTEGER DEFAULT 0,
        notificacoes INTEGER DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Tabela de Grupos
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS grupos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT DEFAULT '',
        tipo_grupo TEXT DEFAULT 'fechado',
        codigo_convite TEXT UNIQUE NOT NULL,
        criado_por INTEGER NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (criado_por) REFERENCES usuarios (id)
    );
    """)

    # 3. Tabela de Membros do Grupo
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS membros_grupo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grupo_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        papel TEXT DEFAULT 'membro',
        entrou_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(grupo_id, usuario_id),
        FOREIGN KEY (grupo_id) REFERENCES grupos (id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    );
    """)

    # 4. Tabela de Despesas
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS despesas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grupo_id INTEGER NOT NULL,
        pago_por INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        categoria TEXT NOT NULL,
        valor_total REAL NOT NULL,
        data_despesa TEXT NOT NULL,
        hora_despesa TEXT NOT NULL,
        local_compra TEXT DEFAULT '',
        tipo_divisao TEXT DEFAULT 'igual',
        status TEXT DEFAULT 'pendente',
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grupo_id) REFERENCES grupos (id) ON DELETE CASCADE,
        FOREIGN KEY (pago_por) REFERENCES usuarios (id)
    );
    """)

    # 5. Tabela de Divisão de Despesa por Membro
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS divisoes_despesa (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        despesa_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        porcentagem REAL DEFAULT 0,
        valor REAL NOT NULL,
        esta_pago INTEGER DEFAULT 0,
        pago_em DATETIME,
        UNIQUE(despesa_id, usuario_id),
        FOREIGN KEY (despesa_id) REFERENCES despesas (id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    );
    """)

    # 6. Tabela de Transações / Histórico
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grupo_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        despesa_id INTEGER,
        titulo TEXT NOT NULL,
        categoria TEXT NOT NULL,
        valor REAL NOT NULL,
        tipo_transacao TEXT NOT NULL,
        data_transacao TEXT NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grupo_id) REFERENCES grupos (id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    );
    """)

    conexao.commit()
    conexao.close()


# ==============================================================================
# ROTAS ESTÁTICAS (Front-end)
# ==============================================================================

@app.route("/")
def index():
    return send_from_directory(DIRETORIO_BASE, "index.html")

@app.route("/style.css")
def css():
    return send_from_directory(DIRETORIO_BASE, "style.css")

@app.route("/app.js")
def js():
    return send_from_directory(DIRETORIO_BASE, "app.js")

@app.route("/img/<path:arquivo>")
def servir_imagem(arquivo):
    return send_from_directory(os.path.join(DIRETORIO_BASE, "img"), arquivo)


# ==============================================================================
# ROTAS DA API REST (Autenticação, Grupos, Despesas, Acertos, Relatórios)
# ==============================================================================

# --- 1. Autenticação e Usuário ---

@app.route("/api/autenticacao/cadastrar", methods=["POST"])
@app.route("/api/autenticacao/cadastro", methods=["POST"])
@app.route("/api/auth/register", methods=["POST"])
def cadastrar_usuario():
    dados = request.get_json() or {}
    nome = (dados.get("nome") or dados.get("name") or "").strip()
    email = (dados.get("email") or "").strip().lower()
    senha = dados.get("senha") or dados.get("password") or ""

    if not nome or not email or not senha:
        return jsonify({"sucesso": False, "success": False, "mensagem": "Preencha todos os campos obrigatórios."}), 400

    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    cursor.execute("SELECT id FROM usuarios WHERE email = ?", (email,))
    if cursor.fetchone():
        conexao.close()
        return jsonify({"sucesso": False, "success": False, "mensagem": "Este e-mail já está cadastrado."}), 409

    senha_criptografada = generate_password_hash(senha)
    cursor.execute("""
        INSERT INTO usuarios (nome, email, senha_hash)
        VALUES (?, ?, ?)
    """, (nome, email, senha_criptografada))
    usuario_id = cursor.lastrowid
    conexao.commit()

    cursor.execute("SELECT id, nome, email, telefone, chave_pix, modo_escuro, notificacoes FROM usuarios WHERE id = ?", (usuario_id,))
    linha_usuario = dict(cursor.fetchone())
    conexao.close()

    usuario_formatado = {
        "id": linha_usuario["id"],
        "nome": linha_usuario["nome"],
        "name": linha_usuario["nome"],
        "email": linha_usuario["email"],
        "telefone": linha_usuario["telefone"],
        "phone": linha_usuario["telefone"],
        "chave_pix": linha_usuario["chave_pix"],
        "pix_key": linha_usuario["chave_pix"],
        "modo_escuro": linha_usuario["modo_escuro"],
        "dark_mode": linha_usuario["modo_escuro"],
        "notificacoes": linha_usuario["notificacoes"],
        "notifications": linha_usuario["notificacoes"]
    }

    return jsonify({
        "sucesso": True,
        "success": True,
        "usuario": usuario_formatado,
        "user": usuario_formatado,
        "grupo_id_ativo": None,
        "activeGroupId": None,
        "mensagem": "Cadastro realizado com sucesso!",
        "message": "Cadastro realizado com sucesso!"
    })

@app.route("/api/autenticacao/entrar", methods=["POST"])
@app.route("/api/autenticacao/login", methods=["POST"])
@app.route("/api/auth/login", methods=["POST"])
def entrar_usuario():
    dados = request.get_json() or {}
    email = (dados.get("email") or "").strip().lower()
    senha = dados.get("senha") or dados.get("password") or ""

    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    cursor.execute("SELECT * FROM usuarios WHERE email = ?", (email,))
    linha = cursor.fetchone()

    if not linha or not check_password_hash(linha["senha_hash"], senha):
        conexao.close()
        return jsonify({"sucesso": False, "success": False, "mensagem": "E-mail ou senha inválidos."}), 401

    usuario_formatado = {
        "id": linha["id"],
        "nome": linha["nome"],
        "name": linha["nome"],
        "email": linha["email"],
        "telefone": linha["telefone"],
        "phone": linha["telefone"],
        "chave_pix": linha["chave_pix"],
        "pix_key": linha["chave_pix"],
        "modo_escuro": linha["modo_escuro"],
        "dark_mode": linha["modo_escuro"],
        "notificacoes": linha["notificacoes"],
        "notifications": linha["notificacoes"]
    }

    # Busca o primeiro grupo do usuário
    cursor.execute("""
        SELECT g.id, g.nome FROM grupos g
        JOIN membros_grupo mg ON mg.grupo_id = g.id
        WHERE mg.usuario_id = ?
        ORDER BY g.id ASC LIMIT 1
    """, (usuario_formatado["id"],))
    linha_grupo = cursor.fetchone()
    grupo_id_ativo = linha_grupo["id"] if linha_grupo else None

    conexao.close()
    return jsonify({
        "sucesso": True,
        "success": True,
        "usuario": usuario_formatado,
        "user": usuario_formatado,
        "grupo_id_ativo": grupo_id_ativo,
        "activeGroupId": grupo_id_ativo,
        "mensagem": "Login realizado com sucesso!",
        "message": "Login realizado com sucesso!"
    })

@app.route("/api/autenticacao/login-social", methods=["POST"])
@app.route("/api/auth/social-login", methods=["POST"])
def entrar_login_social():
    dados = request.get_json() or {}
    provedor = dados.get("provedor") or dados.get("provider") or "Google"
    email = f"usuario.{provedor.lower()}@coinshare.com"
    nome = f"Usuário {provedor}"

    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    cursor.execute("SELECT * FROM usuarios WHERE email = ?", (email,))
    linha = cursor.fetchone()
    if not linha:
        senha_social = generate_password_hash("social123")
        cursor.execute("""
            INSERT INTO usuarios (nome, email, senha_hash)
            VALUES (?, ?, ?)
        """, (nome, email, senha_social))
        usuario_id = cursor.lastrowid
        cursor.execute("SELECT * FROM usuarios WHERE id = ?", (usuario_id,))
        linha = cursor.fetchone()

    usuario_formatado = {
        "id": linha["id"],
        "nome": linha["nome"],
        "name": linha["nome"],
        "email": linha["email"],
        "telefone": linha["telefone"],
        "phone": linha["telefone"],
        "chave_pix": linha["chave_pix"],
        "pix_key": linha["chave_pix"],
        "modo_escuro": linha["modo_escuro"],
        "dark_mode": linha["modo_escuro"],
        "notificacoes": linha["notificacoes"],
        "notifications": linha["notificacoes"]
    }

    cursor.execute("""
        SELECT g.id FROM grupos g
        JOIN membros_grupo mg ON mg.grupo_id = g.id
        WHERE mg.usuario_id = ? LIMIT 1
    """, (usuario_formatado["id"],))
    linha_grupo = cursor.fetchone()
    grupo_id_ativo = linha_grupo["id"] if linha_grupo else None

    conexao.close()
    return jsonify({
        "sucesso": True,
        "success": True,
        "usuario": usuario_formatado,
        "user": usuario_formatado,
        "grupo_id_ativo": grupo_id_ativo,
        "activeGroupId": grupo_id_ativo,
        "mensagem": f"Conectado com sucesso via {provedor}!",
        "message": f"Conectado com sucesso via {provedor}!"
    })

@app.route("/api/autenticacao/perfil", methods=["PUT"])
@app.route("/api/auth/profile", methods=["PUT"])
def atualizar_perfil_usuario():
    dados = request.get_json() or {}
    usuario_id = dados.get("usuario_id") or dados.get("user_id")
    nome = (dados.get("nome") or dados.get("name") or "").strip()
    telefone = (dados.get("telefone") or dados.get("phone") or "").strip()
    chave_pix = (dados.get("chave_pix") or dados.get("pix_key") or "").strip()
    modo_escuro = 1 if (dados.get("modo_escuro") or dados.get("dark_mode")) else 0
    notificacoes = 1 if (dados.get("notificacoes") or dados.get("notifications")) else 0
    nova_senha = dados.get("nova_senha") or dados.get("new_password")

    if not usuario_id:
        return jsonify({"sucesso": False, "success": False, "mensagem": "ID do usuário não fornecido."}), 400

    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    if nova_senha:
        senha_cripto = generate_password_hash(nova_senha)
        cursor.execute("""
            UPDATE usuarios 
            SET nome = ?, telefone = ?, chave_pix = ?, modo_escuro = ?, notificacoes = ?, senha_hash = ?
            WHERE id = ?
        """, (nome, telefone, chave_pix, modo_escuro, notificacoes, senha_cripto, usuario_id))
    else:
        cursor.execute("""
            UPDATE usuarios 
            SET nome = ?, telefone = ?, chave_pix = ?, modo_escuro = ?, notificacoes = ?
            WHERE id = ?
        """, (nome, telefone, chave_pix, modo_escuro, notificacoes, usuario_id))

    conexao.commit()

    cursor.execute("SELECT id, nome, email, telefone, chave_pix, modo_escuro, notificacoes FROM usuarios WHERE id = ?", (usuario_id,))
    linha = dict(cursor.fetchone())
    conexao.close()

    usuario_formatado = {
        "id": linha["id"],
        "nome": linha["nome"],
        "name": linha["nome"],
        "email": linha["email"],
        "telefone": linha["telefone"],
        "phone": linha["telefone"],
        "chave_pix": linha["chave_pix"],
        "pix_key": linha["chave_pix"],
        "modo_escuro": linha["modo_escuro"],
        "dark_mode": linha["modo_escuro"],
        "notificacoes": linha["notificacoes"],
        "notifications": linha["notificacoes"]
    }

    return jsonify({
        "sucesso": True,
        "success": True,
        "usuario": usuario_formatado,
        "user": usuario_formatado,
        "mensagem": "Dados atualizados com sucesso!",
        "message": "Dados atualizados com sucesso!"
    })


# --- 2. Grupos ---

@app.route("/api/grupos", methods=["GET"])
@app.route("/api/groups", methods=["GET"])
def listar_grupos_usuario():
    usuario_id = request.args.get("usuario_id", type=int) or request.args.get("user_id", type=int)
    if not usuario_id:
        return jsonify({"sucesso": False, "success": False, "mensagem": "Usuário não informado."}), 400

    conexao = obter_conexao_banco()
    cursor = conexao.cursor()
    cursor.execute("""
        SELECT g.*, 
               (SELECT COUNT(*) FROM membros_grupo WHERE grupo_id = g.id) AS contagem_membros
        FROM grupos g
        JOIN membros_grupo mg ON mg.grupo_id = g.id
        WHERE mg.usuario_id = ?
        ORDER BY g.id DESC
    """, (usuario_id,))
    
    linhas = cursor.fetchall()
    grupos = []
    for row in linhas:
        item = dict(row)
        item["name"] = item["nome"]
        item["description"] = item["descricao"]
        item["invite_code"] = item["codigo_convite"]
        item["group_type"] = item["tipo_grupo"]
        item["members_count"] = item["contagem_membros"]
        grupos.append(item)

    conexao.close()
    return jsonify({"sucesso": True, "success": True, "grupos": grupos, "groups": grupos})

@app.route("/api/grupos", methods=["POST"])
@app.route("/api/groups", methods=["POST"])
def criar_novo_grupo():
    dados = request.get_json() or {}
    usuario_id = dados.get("usuario_id") or dados.get("user_id")
    nome = (dados.get("nome") or dados.get("name") or "").strip()
    descricao = (dados.get("descricao") or dados.get("description") or "").strip()
    tipo_grupo = dados.get("tipo_grupo") or dados.get("group_type") or "fechado"

    if not usuario_id or not nome:
        return jsonify({"sucesso": False, "success": False, "mensagem": "Nome do grupo é obrigatório."}), 400

    codigo_convite = f"{nome[:3].lower()}{int(datetime.datetime.now().timestamp()) % 10000}"

    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    cursor.execute("""
        INSERT INTO grupos (nome, descricao, tipo_grupo, codigo_convite, criado_por)
        VALUES (?, ?, ?, ?, ?)
    """, (nome, descricao, tipo_grupo, codigo_convite, usuario_id))
    grupo_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO membros_grupo (grupo_id, usuario_id, papel)
        VALUES (?, ?, 'admin')
    """, (grupo_id, usuario_id))

    # Inclusão de participantes adicionais
    participantes = dados.get("membros") or dados.get("members") or []
    for p in participantes:
        cursor.execute("SELECT id FROM usuarios WHERE email = ? OR nome = ?", (p, p))
        u_linha = cursor.fetchone()
        if u_linha and u_linha["id"] != usuario_id:
            try:
                cursor.execute("INSERT INTO membros_grupo (grupo_id, usuario_id, papel) VALUES (?, ?, 'membro')", (grupo_id, u_linha["id"]))
            except sqlite3.IntegrityError:
                pass

    conexao.commit()
    conexao.close()

    return jsonify({
        "sucesso": True,
        "success": True,
        "grupo_id": grupo_id,
        "groupId": grupo_id,
        "codigo_convite": codigo_convite,
        "inviteCode": codigo_convite,
        "mensagem": "Grupo criado com sucesso!",
        "message": "Grupo criado com sucesso!"
    })

@app.route("/api/grupos/<int:grupo_id>/painel", methods=["GET"])
@app.route("/api/groups/<int:grupo_id>/dashboard", methods=["GET"])
def obter_painel_grupo(grupo_id):
    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    cursor.execute("SELECT * FROM grupos WHERE id = ?", (grupo_id,))
    linha_grupo = cursor.fetchone()
    if not linha_grupo:
        conexao.close()
        return jsonify({"sucesso": False, "success": False, "mensagem": "Grupo não encontrado."}), 404

    grupo_dict = dict(linha_grupo)
    grupo_dict["name"] = grupo_dict["nome"]
    grupo_dict["description"] = grupo_dict["descricao"]
    grupo_dict["invite_code"] = grupo_dict["codigo_convite"]
    grupo_dict["group_type"] = grupo_dict["tipo_grupo"]

    # Membros do grupo
    cursor.execute("""
        SELECT u.id, u.nome, u.email, u.chave_pix, mg.papel
        FROM usuarios u
        JOIN membros_grupo mg ON mg.usuario_id = u.id
        WHERE mg.grupo_id = ?
        ORDER BY u.nome ASC
    """, (grupo_id,))
    membros = []
    for m in cursor.fetchall():
        m_dict = dict(m)
        m_dict["name"] = m_dict["nome"]
        m_dict["pix_key"] = m_dict["chave_pix"]
        m_dict["role"] = m_dict["papel"]
        membros.append(m_dict)

    # Saldo total do grupo
    cursor.execute("SELECT COALESCE(SUM(valor_total), 0) as total FROM despesas WHERE grupo_id = ?", (grupo_id,))
    total_grupo = cursor.fetchone()["total"]

    # Balanço de cada membro
    balanco_membros = []
    for m in membros:
        uid = m["id"]
        cursor.execute("SELECT COALESCE(SUM(valor_total), 0) FROM despesas WHERE grupo_id = ? AND pago_por = ?", (grupo_id, uid))
        total_pago = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COALESCE(SUM(dd.valor), 0) FROM divisoes_despesa dd
            JOIN despesas d ON d.id = dd.despesa_id
            WHERE d.grupo_id = ? AND dd.usuario_id = ?
        """, (grupo_id, uid))
        total_devido = cursor.fetchone()[0]

        saldo = round(total_pago - total_devido, 2)
        balanco_membros.append({
            "usuario_id": uid,
            "user_id": uid,
            "nome": m["nome"],
            "name": m["nome"],
            "total_pago": round(total_pago, 2),
            "total_paid": round(total_pago, 2),
            "total_devido": round(total_devido, 2),
            "total_owed": round(total_devido, 2),
            "saldo": saldo,
            "balance": saldo
        })

    # Despesas recentes (últimas 5)
    cursor.execute("""
        SELECT d.*, u.nome as nome_pagador,
               (SELECT COUNT(*) FROM divisoes_despesa WHERE despesa_id = d.id) as contagem_divisoes
        FROM despesas d
        JOIN usuarios u ON u.id = d.pago_por
        WHERE d.grupo_id = ?
        ORDER BY d.id DESC
        LIMIT 5
    """, (grupo_id,))
    despesas_recentes = []
    for row in cursor.fetchall():
        d = dict(row)
        d["title"] = d["titulo"]
        d["category"] = d["categoria"]
        d["total_amount"] = d["valor_total"]
        d["paid_by_name"] = d["nome_pagador"]
        contagem = d["contagem_divisoes"] or 1
        d["valor_por_membro"] = round(d["valor_total"] / contagem, 2)
        d["amount_per_member"] = d["valor_por_membro"]
        despesas_recentes.append(d)

    conexao.close()

    return jsonify({
        "sucesso": True,
        "success": True,
        "grupo": grupo_dict,
        "group": grupo_dict,
        "membros": membros,
        "members": membros,
        "total_grupo": round(total_grupo, 2),
        "group_total": round(total_grupo, 2),
        "balanco_membros": balanco_membros,
        "member_balances": balanco_membros,
        "despesas_recentes": despesas_recentes,
        "recent_expenses": despesas_recentes
    })


@app.route("/api/grupos/<int:grupo_id>/membros", methods=["POST"])
@app.route("/api/groups/<int:grupo_id>/members", methods=["POST"])
def adicionar_membro_grupo(grupo_id):
    dados = request.get_json() or {}
    identificador = (dados.get("email") or dados.get("nome") or dados.get("usuario") or "").strip()
    if not identificador:
        return jsonify({"sucesso": False, "success": False, "mensagem": "Informe o e-mail ou nome do membro."}), 400

    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    cursor.execute("SELECT id, nome, email FROM usuarios WHERE email = ? OR nome = ?", (identificador, identificador))
    usuario = cursor.fetchone()
    if not usuario:
        conexao.close()
        return jsonify({"sucesso": False, "success": False, "mensagem": f"Usuário '{identificador}' não encontrado."}), 404

    usuario_id = usuario["id"]
    cursor.execute("SELECT id FROM membros_grupo WHERE grupo_id = ? AND usuario_id = ?", (grupo_id, usuario_id))
    if cursor.fetchone():
        conexao.close()
        return jsonify({"sucesso": False, "success": False, "mensagem": "Este participante já está no grupo."}), 409

    cursor.execute("INSERT INTO membros_grupo (grupo_id, usuario_id, papel) VALUES (?, ?, 'membro')", (grupo_id, usuario_id))
    conexao.commit()
    conexao.close()

    return jsonify({"sucesso": True, "success": True, "mensagem": f"Membro {usuario['nome']} adicionado com sucesso!"})


# --- 3. Despesas ---

@app.route("/api/grupos/<int:grupo_id>/despesas", methods=["GET"])
@app.route("/api/groups/<int:grupo_id>/expenses", methods=["GET"])
def listar_despesas_grupo(grupo_id):
    usuario_id_req = request.args.get("usuario_id", type=int) or request.args.get("user_id", type=int)
    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    if usuario_id_req:
        cursor.execute("""
            SELECT d.*, u.nome as nome_pagador, u.chave_pix as chave_pix_pagador,
                   (SELECT COUNT(*) FROM divisoes_despesa WHERE despesa_id = d.id) as contagem_membros,
                   (SELECT esta_pago FROM divisoes_despesa WHERE despesa_id = d.id AND usuario_id = ?) as meu_pagamento
            FROM despesas d
            JOIN usuarios u ON u.id = d.pago_por
            WHERE d.grupo_id = ?
            ORDER BY d.id DESC
        """, (usuario_id_req, grupo_id))
    else:
        cursor.execute("""
            SELECT d.*, u.nome as nome_pagador, u.chave_pix as chave_pix_pagador,
                   (SELECT COUNT(*) FROM divisoes_despesa WHERE despesa_id = d.id) as contagem_membros
            FROM despesas d
            JOIN usuarios u ON u.id = d.pago_por
            WHERE d.grupo_id = ?
            ORDER BY d.id DESC
        """, (grupo_id,))

    despesas = []
    for row in cursor.fetchall():
        item = dict(row)
        item["title"] = item["titulo"]
        item["category"] = item["categoria"]
        item["total_amount"] = item["valor_total"]
        item["paid_by_name"] = item["nome_pagador"]
        item["paid_by_pix"] = item["chave_pix_pagador"]
        contagem = item["contagem_membros"] or 1
        item["valor_por_membro"] = round(item["valor_total"] / contagem, 2)
        item["amount_per_member"] = item["valor_por_membro"]

        if usuario_id_req:
            # Quem registra a despesa é sempre o recebedor e já pagou na compra
            if item["pago_por"] == usuario_id_req:
                item["status_usuario"] = "pago"
            else:
                item["status_usuario"] = "pago" if item.get("meu_pagamento") == 1 else "pendente"

        despesas.append(item)

    conexao.close()
    return jsonify({"sucesso": True, "success": True, "despesas": despesas, "expenses": despesas})

@app.route("/api/despesas/<int:despesa_id>", methods=["GET"])
@app.route("/api/expenses/<int:despesa_id>", methods=["GET"])
def obter_detalhes_despesa(despesa_id):
    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    cursor.execute("""
        SELECT d.*, u.nome as nome_pagador, u.chave_pix as chave_pix_pagador
        FROM despesas d
        JOIN usuarios u ON u.id = d.pago_por
        WHERE d.id = ?
    """, (despesa_id,))
    linha = cursor.fetchone()
    if not linha:
        conexao.close()
        return jsonify({"sucesso": False, "success": False, "mensagem": "Despesa não encontrada."}), 404

    despesa = dict(linha)
    despesa["title"] = despesa["titulo"]
    despesa["category"] = despesa["categoria"]
    despesa["total_amount"] = despesa["valor_total"]
    despesa["paid_by_name"] = despesa["nome_pagador"]
    despesa["paid_by_pix"] = despesa["chave_pix_pagador"]

    cursor.execute("""
        SELECT dd.*, u.nome as nome_membro, u.chave_pix
        FROM divisoes_despesa dd
        JOIN usuarios u ON u.id = dd.usuario_id
        WHERE dd.despesa_id = ?
        ORDER BY u.nome ASC
    """, (despesa_id,))
    divisoes = []
    for s in cursor.fetchall():
        s_dict = dict(s)
        s_dict["member_name"] = s_dict["nome_membro"]
        s_dict["pix_key"] = s_dict["chave_pix"]
        s_dict["amount"] = s_dict["valor"]
        s_dict["percentage"] = s_dict["porcentagem"]
        s_dict["is_paid"] = s_dict["esta_pago"]
        divisoes.append(s_dict)

    despesa["divisoes"] = divisoes
    despesa["splits"] = divisoes
    contagem = len(divisoes) or 1
    despesa["valor_por_membro"] = round(despesa["valor_total"] / contagem, 2)
    despesa["amount_per_member"] = despesa["valor_por_membro"]

    conexao.close()
    return jsonify({"sucesso": True, "success": True, "despesa": despesa, "expense": despesa})

@app.route("/api/despesas/<int:despesa_id>", methods=["PUT"])
@app.route("/api/despesas/<int:despesa_id>/editar", methods=["POST"])
@app.route("/api/expenses/<int:despesa_id>", methods=["PUT"])
def editar_despesa(despesa_id):
    dados = request.get_json() or {}
    titulo = (dados.get("titulo") or dados.get("title") or "").strip()
    categoria = (dados.get("categoria") or dados.get("category") or "Alimentação").strip()
    novo_valor_total = float(dados.get("valor_total") or dados.get("total_amount") or 0)
    local_compra = (dados.get("local_compra") or dados.get("location") or "").strip()

    if not titulo or novo_valor_total <= 0:
        return jsonify({"sucesso": False, "success": False, "mensagem": "Dados da despesa inválidos."}), 400

    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    cursor.execute("SELECT * FROM despesas WHERE id = ?", (despesa_id,))
    despesa = cursor.fetchone()
    if not despesa:
        conexao.close()
        return jsonify({"sucesso": False, "success": False, "mensagem": "Despesa não encontrada."}), 404

    # Atualizar dados principais da despesa
    cursor.execute("""
        UPDATE despesas
        SET titulo = ?, categoria = ?, valor_total = ?, local_compra = ?
        WHERE id = ?
    """, (titulo, categoria, novo_valor_total, local_compra, despesa_id))

    # Recalcular valores nas divisões de despesa
    cursor.execute("SELECT * FROM divisoes_despesa WHERE despesa_id = ?", (despesa_id,))
    divisoes = cursor.fetchall()
    num_divisoes = len(divisoes)

    if num_divisoes > 0:
        if despesa["tipo_divisao"] == "desigual":
            for d in divisoes:
                pct = d["porcentagem"]
                novo_val = round(novo_valor_total * (pct / 100.0), 2)
                cursor.execute("UPDATE divisoes_despesa SET valor = ? WHERE id = ?", (novo_val, d["id"]))
        else:
            valor_dividido = round(novo_valor_total / num_divisoes, 2)
            cursor.execute("UPDATE divisoes_despesa SET valor = ? WHERE despesa_id = ?", (valor_dividido, despesa_id))

    # Atualizar movimentação no histórico de transações
    cursor.execute("""
        UPDATE transacoes
        SET titulo = ?, categoria = ?, valor = ?
        WHERE despesa_id = ? AND tipo_transacao = 'saida'
    """, (titulo, categoria, novo_valor_total, despesa_id))

    conexao.commit()
    conexao.close()

    return jsonify({
        "sucesso": True,
        "success": True,
        "mensagem": "Despesa atualizada com sucesso!"
    })

@app.route("/api/despesas/<int:despesa_id>", methods=["DELETE"])
@app.route("/api/despesas/<int:despesa_id>/excluir", methods=["POST"])
@app.route("/api/expenses/<int:despesa_id>", methods=["DELETE"])
def excluir_despesa(despesa_id):
    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    cursor.execute("SELECT * FROM despesas WHERE id = ?", (despesa_id,))
    despesa = cursor.fetchone()
    if not despesa:
        conexao.close()
        return jsonify({"sucesso": False, "success": False, "mensagem": "Despesa não encontrada."}), 404

    # Remover transações vinculadas à despesa
    cursor.execute("DELETE FROM transacoes WHERE despesa_id = ?", (despesa_id,))

    # Remover divisões da despesa
    cursor.execute("DELETE FROM divisoes_despesa WHERE despesa_id = ?", (despesa_id,))

    # Remover a despesa
    cursor.execute("DELETE FROM despesas WHERE id = ?", (despesa_id,))

    conexao.commit()
    conexao.close()

    return jsonify({
        "sucesso": True,
        "success": True,
        "mensagem": "Despesa excluída com sucesso!"
    })

@app.route("/api/grupos/<int:grupo_id>/despesas", methods=["POST"])
@app.route("/api/groups/<int:grupo_id>/expenses", methods=["POST"])
def criar_nova_despesa(grupo_id):
    dados = request.get_json() or {}
    pago_por = dados.get("pago_por") or dados.get("paid_by")
    titulo = (dados.get("titulo") or dados.get("title") or "").strip()
    categoria = (dados.get("categoria") or dados.get("category") or "Alimentação").strip()
    valor_total = float(dados.get("valor_total") or dados.get("total_amount") or 0)
    local_compra = (dados.get("local_compra") or dados.get("location") or "").strip()
    tipo_divisao = dados.get("tipo_divisao") or dados.get("split_type") or "igual"
    divisoes_enviadas = dados.get("divisoes") or dados.get("splits") or []

    if not pago_por or not titulo or valor_total <= 0:
        return jsonify({"sucesso": False, "success": False, "mensagem": "Dados da despesa inválidos."}), 400

    agora = datetime.datetime.now()
    data_despesa = dados.get("data_despesa") or dados.get("expense_date") or agora.strftime("%Y-%m-%d")
    hora_despesa = dados.get("hora_despesa") or dados.get("expense_time") or agora.strftime("%H:%M")

    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    cursor.execute("""
        INSERT INTO despesas (grupo_id, pago_por, titulo, categoria, valor_total, data_despesa, hora_despesa, local_compra, tipo_divisao, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')
    """, (grupo_id, pago_por, titulo, categoria, valor_total, data_despesa, hora_despesa, local_compra, tipo_divisao))
    despesa_id = cursor.lastrowid

    if not divisoes_enviadas:
        cursor.execute("SELECT usuario_id FROM membros_grupo WHERE grupo_id = ?", (grupo_id,))
        membros_ids = [m["usuario_id"] for m in cursor.fetchall()]
        num_membros = len(membros_ids)
        if num_membros > 0:
            valor_dividido = round(valor_total / num_membros, 2)
            porcentagem = round(100.0 / num_membros, 2)
            for uid in membros_ids:
                foi_pago = 1 if uid == int(pago_por) else 0
                cursor.execute("""
                    INSERT INTO divisoes_despesa (despesa_id, usuario_id, porcentagem, valor, esta_pago, pago_em)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (despesa_id, uid, porcentagem, valor_dividido, foi_pago, agora if foi_pago else None))
    else:
        for s in divisoes_enviadas:
            uid = int(s.get("usuario_id") or s.get("user_id"))
            pct = float(s.get("porcentagem") or s.get("percentage") or 0)
            val = float(s.get("valor") or s.get("amount") or round(valor_total * (pct / 100), 2))
            foi_pago = 1 if uid == int(pago_por) else 0
            cursor.execute("""
                INSERT INTO divisoes_despesa (despesa_id, usuario_id, porcentagem, valor, esta_pago, pago_em)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (despesa_id, uid, pct, val, foi_pago, agora if foi_pago else None))

    cursor.execute("SELECT COUNT(*) FROM divisoes_despesa WHERE despesa_id = ? AND esta_pago = 0", (despesa_id,))
    restantes = cursor.fetchone()[0]
    if restantes == 0:
        cursor.execute("UPDATE despesas SET status = 'pago' WHERE id = ?", (despesa_id,))

    cursor.execute("""
        INSERT INTO transacoes (grupo_id, usuario_id, despesa_id, titulo, categoria, valor, tipo_transacao, data_transacao)
        VALUES (?, ?, ?, ?, ?, ?, 'saida', ?)
    """, (grupo_id, pago_por, despesa_id, titulo, categoria, valor_total, agora.strftime("%d/%m/%Y")))

    conexao.commit()
    conexao.close()

    return jsonify({
        "sucesso": True,
        "success": True,
        "despesa_id": despesa_id,
        "expenseId": despesa_id,
        "mensagem": "Despesa lançada com sucesso!",
        "message": "Despesa lançada com sucesso!"
    })

@app.route("/api/despesas/<int:despesa_id>/pagar", methods=["POST"])
@app.route("/api/expenses/<int:despesa_id>/pay", methods=["POST"])
def pagar_despesa_membro(despesa_id):
    dados = request.get_json() or {}
    usuario_id = dados.get("usuario_id") or dados.get("user_id")
    valor = float(dados.get("valor") or dados.get("amount") or 0)

    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    cursor.execute("SELECT * FROM despesas WHERE id = ?", (despesa_id,))
    despesa = cursor.fetchone()
    if not despesa:
        conexao.close()
        return jsonify({"sucesso": False, "success": False, "mensagem": "Despesa não encontrada."}), 404

    agora = datetime.datetime.now()
    if usuario_id:
        cursor.execute("""
            UPDATE divisoes_despesa 
            SET esta_pago = 1, pago_em = ?
            WHERE despesa_id = ? AND usuario_id = ?
        """, (agora, despesa_id, usuario_id))
    else:
        cursor.execute("""
            UPDATE divisoes_despesa 
            SET esta_pago = 1, pago_em = ?
            WHERE despesa_id = ?
        """, (agora, despesa_id))

    cursor.execute("SELECT COUNT(*) FROM divisoes_despesa WHERE despesa_id = ? AND esta_pago = 0", (despesa_id,))
    restantes = cursor.fetchone()[0]

    novo_status = "pago" if restantes == 0 else "pendente"
    cursor.execute("UPDATE despesas SET status = ? WHERE id = ?", (novo_status, despesa_id))

    cursor.execute("""
        INSERT INTO transacoes (grupo_id, usuario_id, despesa_id, titulo, categoria, valor, tipo_transacao, data_transacao)
        VALUES (?, ?, ?, ?, 'Transferência Pix', ?, 'entrada', ?)
    """, (despesa["grupo_id"], usuario_id or despesa["pago_por"], despesa_id, f"Pagamento: {despesa['titulo']}", valor or despesa["valor_total"], agora.strftime("%d/%m/%Y")))

    conexao.commit()
    conexao.close()

    return jsonify({
        "sucesso": True,
        "success": True,
        "status": novo_status,
        "mensagem": "Pagamento confirmado com sucesso!",
        "message": "Pagamento confirmado com sucesso!"
    })


# --- 4. Acerto de Contas ---

@app.route("/api/grupos/<int:grupo_id>/acertos", methods=["GET"])
@app.route("/api/groups/<int:grupo_id>/settlements", methods=["GET"])
def obter_acerto_contas(grupo_id):
    usuario_atual_id = request.args.get("usuario_id", type=int) or request.args.get("user_id", type=int)

    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    cursor.execute("""
        SELECT u.id, u.nome, u.chave_pix
        FROM usuarios u
        JOIN membros_grupo mg ON mg.usuario_id = u.id
        WHERE mg.grupo_id = ?
    """, (grupo_id,))
    membros = {linha["id"]: {"nome": linha["nome"], "name": linha["nome"], "chave_pix": linha["chave_pix"], "pix_key": linha["chave_pix"]} for linha in cursor.fetchall()}

    balancos = {uid: 0.0 for uid in membros}

    # Créditos (quem pagou despesas)
    cursor.execute("""
        SELECT pago_por, SUM(valor_total) as total_pago
        FROM despesas
        WHERE grupo_id = ?
        GROUP BY pago_por
    """, (grupo_id,))
    for row in cursor.fetchall():
        uid = row["pago_por"]
        if uid in balancos:
            balancos[uid] += row["total_pago"]

    # Débitos (splits)
    cursor.execute("""
        SELECT dd.usuario_id, SUM(dd.valor) as total_divisao
        FROM divisoes_despesa dd
        JOIN despesas d ON d.id = dd.despesa_id
        WHERE d.grupo_id = ?
        GROUP BY dd.usuario_id
    """, (grupo_id,))
    for row in cursor.fetchall():
        uid = row["usuario_id"]
        if uid in balancos:
            balancos[uid] -= row["total_divisao"]

    # Débitos quitados
    cursor.execute("""
        SELECT dd.usuario_id, d.pago_por, SUM(dd.valor) as valor_pago
        FROM divisoes_despesa dd
        JOIN despesas d ON d.id = dd.despesa_id
        WHERE d.grupo_id = ? AND dd.esta_pago = 1 AND dd.usuario_id != d.pago_por
        GROUP BY dd.usuario_id, d.pago_por
    """, (grupo_id,))
    for row in cursor.fetchall():
        u_devedor = row["usuario_id"]
        u_credor = row["pago_por"]
        v_pago = row["valor_pago"]
        if u_devedor in balancos:
            balancos[u_devedor] += v_pago
        if u_credor in balancos:
            balancos[u_credor] -= v_pago

    devedores = []
    credores = []
    for uid, saldo in balancos.items():
        s_round = round(saldo, 2)
        if s_round < -0.01:
            devedores.append({"usuario_id": uid, "user_id": uid, "valor": -s_round, "amount": -s_round})
        elif s_round > 0.01:
            credores.append({"usuario_id": uid, "user_id": uid, "valor": s_round, "amount": s_round})

    lista_dividas = []
    d_idx = 0
    c_idx = 0

    while d_idx < len(devedores) and c_idx < len(credores):
        devedor = devedores[d_idx]
        credor = credores[c_idx]

        valor_acerto = min(devedor["valor"], credor["valor"])
        valor_acerto_round = round(valor_acerto, 2)

        if valor_acerto_round > 0:
            uid_origem = devedor["usuario_id"]
            uid_destino = credor["usuario_id"]
            lista_dividas.append({
                "de_usuario_id": uid_origem,
                "from_user_id": uid_origem,
                "de_nome": membros[uid_origem]["nome"],
                "from_name": membros[uid_origem]["nome"],
                "para_usuario_id": uid_destino,
                "to_user_id": uid_destino,
                "para_nome": membros[uid_destino]["nome"],
                "to_name": membros[uid_destino]["nome"],
                "para_chave_pix": membros[uid_destino]["chave_pix"],
                "to_pix": membros[uid_destino]["chave_pix"],
                "valor": valor_acerto_round,
                "amount": valor_acerto_round
            })

        devedor["valor"] -= valor_acerto
        credor["valor"] -= valor_acerto

        if devedor["valor"] <= 0.01:
            d_idx += 1
        if credor["valor"] <= 0.01:
            c_idx += 1

    total_pagar = 0.0
    total_receber = 0.0
    if usuario_atual_id:
        for div in lista_dividas:
            if div["de_usuario_id"] == usuario_atual_id:
                total_pagar += div["valor"]
            if div["para_usuario_id"] == usuario_atual_id:
                total_receber += div["valor"]

    balanco_geral = round(total_receber - total_pagar, 2)

    conexao.close()

    return jsonify({
        "sucesso": True,
        "success": True,
        "resumo": {
            "total_a_pagar": round(total_pagar, 2),
            "total_to_pay": round(total_pagar, 2),
            "total_a_receber": round(total_receber, 2),
            "total_to_receive": round(total_receber, 2),
            "balanco_geral": balanco_geral,
            "general_balance": balanco_geral
        },
        "summary": {
            "total_to_pay": round(total_pagar, 2),
            "total_to_receive": round(total_receber, 2),
            "general_balance": balanco_geral
        },
        "dividas": lista_dividas,
        "debts": lista_dividas
    })

@app.route("/api/grupos/<int:grupo_id>/acertos/liquidar", methods=["POST"])
@app.route("/api/groups/<int:grupo_id>/settlements/settle", methods=["POST"])
def liquidar_acerto_contas(grupo_id):
    dados = request.get_json() or {}
    devedor_id = dados.get("devedor_id") or dados.get("from_user_id")
    credor_id = dados.get("credor_id") or dados.get("to_user_id")
    valor = float(dados.get("valor") or dados.get("amount") or 0)

    if not devedor_id or not credor_id:
        return jsonify({
            "sucesso": False,
            "success": False,
            "mensagem": "Devedor e credor são obrigatórios para liquidar o acerto."
        }), 400

    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    # Obter nomes dos participantes
    cursor.execute("SELECT id, nome FROM usuarios WHERE id IN (?, ?)", (devedor_id, credor_id))
    nomes = {r["id"]: r["nome"] for r in cursor.fetchall()}
    nome_devedor = nomes.get(devedor_id, "Participante")
    nome_credor = nomes.get(credor_id, "Recebedor")

    agora = datetime.datetime.now()

    # Localizar divisões pendentes onde pago_por = credor_id e usuario_id = devedor_id
    cursor.execute("""
        SELECT dd.id, dd.despesa_id, dd.valor
        FROM divisoes_despesa dd
        JOIN despesas d ON d.id = dd.despesa_id
        WHERE d.grupo_id = ? AND dd.usuario_id = ? AND d.pago_por = ? AND dd.esta_pago = 0
        ORDER BY dd.id ASC
    """, (grupo_id, devedor_id, credor_id))
    divisoes = cursor.fetchall()

    # Caso não haja vínculo direto único, busca divisões pendentes do devedor no grupo
    if not divisoes:
        cursor.execute("""
            SELECT dd.id, dd.despesa_id, dd.valor
            FROM divisoes_despesa dd
            JOIN despesas d ON d.id = dd.despesa_id
            WHERE d.grupo_id = ? AND dd.usuario_id = ? AND dd.esta_pago = 0
            ORDER BY dd.id ASC
        """, (grupo_id, devedor_id))
        divisoes = cursor.fetchall()

    despesas_afetadas = set()
    for row in divisoes:
        dd_id = row["id"]
        despesa_id = row["despesa_id"]
        cursor.execute("""
            UPDATE divisoes_despesa
            SET esta_pago = 1, pago_em = ?
            WHERE id = ?
        """, (agora, dd_id))
        despesas_afetadas.add(despesa_id)

    # Atualizar status das despesas para 'pago' se todas as suas divisões foram quitadas
    for d_id in despesas_afetadas:
        cursor.execute("SELECT COUNT(*) FROM divisoes_despesa WHERE despesa_id = ? AND esta_pago = 0", (d_id,))
        restantes = cursor.fetchone()[0]
        if restantes == 0:
            cursor.execute("UPDATE despesas SET status = 'pago' WHERE id = ?", (d_id,))

    # Registrar movimentação no histórico de transações
    despesa_ref_id = list(despesas_afetadas)[0] if despesas_afetadas else None
    cursor.execute("""
        INSERT INTO transacoes (grupo_id, usuario_id, despesa_id, titulo, categoria, valor, tipo_transacao, data_transacao)
        VALUES (?, ?, ?, ?, 'Acerto de Contas', ?, 'entrada', ?)
    """, (
        grupo_id,
        devedor_id,
        despesa_ref_id,
        f"Acerto de Contas: {nome_devedor} pagou para {nome_credor}",
        valor,
        agora.strftime("%d/%m/%Y")
    ))

    conexao.commit()
    conexao.close()

    return jsonify({
        "sucesso": True,
        "success": True,
        "mensagem": f"Acerto de contas de {nome_devedor} marcado como pago com sucesso!",
        "message": f"Acerto de contas de {nome_devedor} marcado como pago com sucesso!"
    })


# --- 5. Relatórios e Estatísticas ---

@app.route("/api/grupos/<int:grupo_id>/relatorios", methods=["GET"])
@app.route("/api/groups/<int:grupo_id>/reports", methods=["GET"])
def obter_relatorios(grupo_id):
    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    # Compras por Membro
    cursor.execute("""
        SELECT u.id, u.nome, COALESCE(SUM(d.valor_total), 0) as total
        FROM membros_grupo mg
        JOIN usuarios u ON u.id = mg.usuario_id
        LEFT JOIN despesas d ON d.pago_por = u.id AND d.grupo_id = mg.grupo_id
        WHERE mg.grupo_id = ?
        GROUP BY u.id, u.nome
        ORDER BY total DESC
    """, (grupo_id,))
    por_membro = [dict(r) for r in cursor.fetchall()]
    for m in por_membro:
        m["name"] = m["nome"]

    # Compras por Categoria
    cursor.execute("""
        SELECT categoria, COALESCE(SUM(valor_total), 0) as total
        FROM despesas
        WHERE grupo_id = ?
        GROUP BY categoria
        ORDER BY total DESC
    """, (grupo_id,))
    por_categoria = [dict(r) for r in cursor.fetchall()]
    for c in por_categoria:
        c["category"] = c["categoria"]

    # Índice de Pagamento de cada participante (Requisito 3.5 do Escopo / Figura 11 do Protótipo)
    cursor.execute("""
        SELECT u.id, u.nome,
               COUNT(dd.id) as total_dividas,
               SUM(CASE WHEN dd.esta_pago = 1 THEN 1 ELSE 0 END) as dividas_pagas
        FROM membros_grupo mg
        JOIN usuarios u ON u.id = mg.usuario_id
        LEFT JOIN divisoes_despesa dd ON dd.usuario_id = u.id
        LEFT JOIN despesas d ON d.id = dd.despesa_id AND d.grupo_id = mg.grupo_id
        WHERE mg.grupo_id = ?
        GROUP BY u.id, u.nome
    """, (grupo_id,))

    lista_conformidade = []
    for r in cursor.fetchall():
        total_d = r["total_dividas"] or 0
        pagas_d = r["dividas_pagas"] or 0
        taxa = int(round((pagas_d / total_d) * 100)) if total_d > 0 else 100
        lista_conformidade.append({
            "usuario_id": r["id"],
            "user_id": r["id"],
            "nome": r["nome"],
            "name": r["nome"],
            "taxa_pagamento": taxa,
            "compliance_rate": taxa
        })

    conexao.close()

    return jsonify({
        "sucesso": True,
        "success": True,
        "por_membro": por_membro,
        "by_member": por_membro,
        "por_categoria": por_categoria,
        "by_category": por_categoria,
        "conformidade": lista_conformidade,
        "compliance": lista_conformidade
    })


# --- 6. Histórico de Transações ---

@app.route("/api/grupos/<int:grupo_id>/transacoes", methods=["GET"])
@app.route("/api/groups/<int:grupo_id>/transactions", methods=["GET"])
def obter_historico_transacoes(grupo_id):
    tipo_filtro = request.args.get("tipo") or request.args.get("type") or "todos"

    conexao = obter_conexao_banco()
    cursor = conexao.cursor()

    query = """
        SELECT t.*, u.nome as nome_usuario
        FROM transacoes t
        JOIN usuarios u ON u.id = t.usuario_id
        WHERE t.grupo_id = ?
    """
    params = [grupo_id]

    if tipo_filtro == "entradas":
        query += " AND t.tipo_transacao = 'entrada'"
    elif tipo_filtro == "saidas":
        query += " AND t.tipo_transacao = 'saida'"

    query += " ORDER BY t.id DESC"

    cursor.execute(query, params)
    transacoes = []
    for r in cursor.fetchall():
        item = dict(r)
        item["user_name"] = item["nome_usuario"]
        item["title"] = item["titulo"]
        item["category"] = item["categoria"]
        item["amount"] = item["valor"]
        item["tx_type"] = item["tipo_transacao"]
        item["tx_date"] = item["data_transacao"]
        transacoes.append(item)

    cursor.execute("SELECT COALESCE(SUM(valor_total), 0) as total FROM despesas WHERE grupo_id = ?", (grupo_id,))
    total_grupo = cursor.fetchone()["total"]

    conexao.close()

    return jsonify({
        "sucesso": True,
        "success": True,
        "total_grupo": round(total_grupo, 2),
        "group_total": round(total_grupo, 2),
        "transacoes": transacoes,
        "transactions": transacoes
    })

# --- 7. Buscar Participantes ---

@app.route("/api/usuarios/buscar", methods=["GET"])
@app.route("/api/users/search", methods=["GET"])
def buscar_usuarios():
    termo = (request.args.get("q") or "").strip()
    conexao = obter_conexao_banco()
    cursor = conexao.cursor()
    cursor.execute("""
        SELECT id, nome, email FROM usuarios
        WHERE nome LIKE ? OR email LIKE ?
        LIMIT 10
    """, (f"%{termo}%", f"%{termo}%"))
    usuarios = []
    for r in cursor.fetchall():
        u = dict(r)
        u["name"] = u["nome"]
        usuarios.append(u)
    conexao.close()
    return jsonify({"sucesso": True, "success": True, "usuarios": usuarios, "users": usuarios})


if __name__ == "__main__":
    inicializar_banco()
    print("Iniciando CoinShare Flask API em http://127.0.0.1:5000 ...")
    app.run(host="0.0.0.0", port=5000, debug=True)
