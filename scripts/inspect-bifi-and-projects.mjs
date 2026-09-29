import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://tkbivipqiewkfnhktmqq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
  console.log("=== SUPABASE PROJECTS ===");
  const { data: projects, error } = await sb.from('imphq_projects').select('*');
  if (error) {
    console.error("Error fetching projects:", error);
    return;
  }
  
  for (const p of projects) {
    console.log(`\nProject: ${p.name} | Slug: ${p.slug} | ID: ${p.id}`);
    const d = typeof p.data === 'string' ? JSON.parse(p.data) : p.data || {};
    console.log(`  Niche: ${p.niche}`);
    console.log(`  Público-alvo / Avatar:`, d.publico_alvo || d.avatar?.nome || 'Não definido');
    console.log(`  Dores:`, (d.dores || []).slice(0, 3));
    console.log(`  Desejos:`, (d.desejos || []).slice(0, 3));
    console.log(`  Produtos cadastrados:`, (d.produtos || []).map(prod => prod.nome));
  }
}

inspect();
