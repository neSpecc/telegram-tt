/* eslint-disable no-null/no-null */
import type { ApiFormattedText } from '../../../../api/types';
import type { ASTNode, ASTRootNode } from './entities/ASTNode';
import type { OffsetMappingRecord } from './entities/OffsetMapping';
import type { RendererOptions } from './RendererHtml';

import { generateNodeId } from '../helpers/node';

import { ApiFormattedParser } from './ApiFormattedParser';
import { Parser } from './Parser';
import { RendererHtml } from './RendererHtml';
import { tokenize } from './Tokenizer';

export class MarkdownParser {
  private renderer: RendererHtml;

  private ast: ASTRootNode | null = null;

  private parentMap = new WeakMap<ASTNode, ASTNode>();

  private nodeIdMap = new Map<string, ASTNode>();

  constructor(private readonly isRich: boolean = true) {
    this.renderer = new RendererHtml();
  }

  public getAST(): ASTRootNode {
    if (!this.ast) {
      return {
        type: 'root',
        children: [],
        raw: '',
      };
    }

    return this.ast;
  }

  public setAST(ast: ASTRootNode) {
    this.ast = ast;

    this.nodeIdMap = new Map();
    this.assingNodeIds(this.ast);

    this.parentMap = new WeakMap();
    this.buildParentMap(this.ast);
  }

  public fromString(markdown: string) {
    const ast = this.parse(markdown) as ASTRootNode;

    this.setAST(ast);

    return this.ast;
  }

  public fromApiFormattedText(apiFormattedText: ApiFormattedText) {
    const apiParser = new ApiFormattedParser(this.isRich);

    const ast = apiParser.fromApiFormattedToAst(apiFormattedText) as ASTRootNode;

    this.setAST(ast);

    return this.ast;
  }

  public render(options: RendererOptions): string {
    if (!this.ast) {
      return '';
    }

    return this.renderer.render(this.ast, options);
  }

  /**
   * Parses markdown text and returns HTML
   */
  public toHTML({ isPreview = false }: { isPreview?: boolean } = {}): string {
    const ast = this.ast;

    if (!ast) {
      return '';
    }

    return this.renderer.render(ast, { mode: 'html', isPreview });
  }

  /**
   * Parses markdown text and returns normalized markdown
   */
  public toMarkdown(ast: ASTNode | null = this.ast): string {
    if (!ast) {
      return '';
    }

    return this.renderer.render(ast, { mode: 'markdown' });
  }

  /**
   * Parses markdown text and returns normalized markdown
   */
  public toApiFormattedText(ast: ASTNode | null = this.ast): ApiFormattedText {
    if (!ast) {
      return {
        text: '',
        entities: [],
      };
    }

    const apiParser = new ApiFormattedParser();

    return apiParser.fromAstToApiFormatted(ast);
  }

  /**
   * Parses markdown text and returns AST
   */
  public parse(markdown: string): ASTNode {
    const tokens = tokenize(markdown, this.isRich);
    return new Parser(tokens).parse();
  }

  public getOffsetMapping(): OffsetMappingRecord[] {
    return this.renderer.getOffsetMapping();
  }

  public getParentNode(node: ASTNode): ASTNode | null {
    return this.parentMap.get(node) || null;
  }

  public replaceNode(node: ASTNode, newNode: ASTNode) {
    const parent: ASTNode | null = this.getParentNode(node);

    if (parent && 'children' in parent && Array.isArray(parent.children)) {
      parent.children = parent.children.map((child: ASTNode) => (child === node ? newNode : child));
    }
  }

  public getNodeById(id: string): ASTNode | null {
    return this.nodeIdMap.get(id) || null;
  }

  private buildParentMap(node: ASTNode, parent: ASTNode | null = null) {
    if (parent) {
      this.parentMap.set(node, parent);
    }

    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.buildParentMap(child, node);
      }
    }
  }

  private assingNodeIds(node: ASTNode): ASTNode {
    if ('children' in node) {
      node.children?.forEach((child) => this.assingNodeIds(child));
    }

    node.id = generateNodeId();
    this.nodeIdMap.set(node.id, node);

    return node;
  }
}
