-- CreateTable
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT conversations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agent_registry(id) ON DELETE CASCADE,
  CONSTRAINT conversations_user_agent_unique UNIQUE (user_id, agent_id)
);

-- CreateTable
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  cost NUMERIC(10, 6),
  trace_session_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT messages_trace_session_id_fkey FOREIGN KEY (trace_session_id) REFERENCES trace_sessions(id) ON DELETE SET NULL,
  CONSTRAINT messages_role_check CHECK (role IN ('user', 'assistant'))
);

-- CreateIndex
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_trace_session ON messages(trace_session_id);

-- Enable RLS on new tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY conversations_select ON conversations
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', TRUE)::TEXT);

CREATE POLICY conversations_insert ON conversations
  FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::TEXT);

CREATE POLICY conversations_update ON conversations
  FOR UPDATE
  USING (user_id = current_setting('app.current_user_id', TRUE)::TEXT)
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::TEXT);

CREATE POLICY conversations_delete ON conversations
  FOR DELETE
  USING (user_id = current_setting('app.current_user_id', TRUE)::TEXT);

-- RLS Policies for messages (via conversation ownership)
CREATE POLICY messages_select ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = messages.conversation_id 
      AND c.user_id = current_setting('app.current_user_id', TRUE)::TEXT
    )
  );

CREATE POLICY messages_insert ON messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = messages.conversation_id 
      AND c.user_id = current_setting('app.current_user_id', TRUE)::TEXT
    )
  );

CREATE POLICY messages_delete ON messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = messages.conversation_id 
      AND c.user_id = current_setting('app.current_user_id', TRUE)::TEXT
    )
  );
