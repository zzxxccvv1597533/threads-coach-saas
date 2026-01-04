#!/usr/bin/env python3
"""
匯入爆款數據優化系統的所有數據
- Top200 爆款貼文
- Top20_by_Keyword (1040 筆)
- 選題模板庫 (48 筆)
- 內容群集 (8 筆)
"""

import pandas as pd
import mysql.connector
import os
from datetime import datetime

EXCEL_FILE = '/home/ubuntu/upload/2_爆款分析儀表板_7大成果物_Part1(1).xlsx'

# 從 DATABASE_URL 解析連線資訊
def parse_database_url(url):
    # mysql://user:pass@host:port/dbname?ssl-mode=REQUIRED
    import urllib.parse
    result = urllib.parse.urlparse(url)
    return {
        'host': result.hostname,
        'port': result.port or 4000,
        'user': result.username,
        'password': result.password,
        'database': result.path.lstrip('/').split('?')[0],
    }

# 讀取 .env 檔案
def load_env():
    env_path = '/home/ubuntu/threads-coach-saas/.env'
    if os.path.exists(env_path):
        from dotenv import load_dotenv
        load_dotenv(env_path)
    else:
        # 嘗試從系統環境讀取
        pass

try:
    from dotenv import load_dotenv
    load_dotenv('/home/ubuntu/threads-coach-saas/.env')
except:
    load_env()
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print("錯誤: DATABASE_URL 環境變數未設定")
    exit(1)

db_config = parse_database_url(DATABASE_URL)
db_config['ssl_disabled'] = False

def get_connection():
    return mysql.connector.connect(**db_config)

def safe_date(val):
    """安全轉換日期"""
    if pd.isna(val):
        return None
    if isinstance(val, datetime):
        if val.year < 2000 or val.year > 2030:
            return None
        return val
    if isinstance(val, (int, float)):
        # Excel 序列號
        try:
            from datetime import timedelta
            excel_epoch = datetime(1899, 12, 30)
            date = excel_epoch + timedelta(days=val)
            if date.year < 2000 or date.year > 2030:
                return None
            return date
        except:
            return None
    return None

def safe_int(val, default=0):
    """安全轉換整數"""
    if pd.isna(val):
        return default
    try:
        return int(val)
    except:
        return default

def safe_float(val, default=0.0):
    """安全轉換浮點數"""
    if pd.isna(val):
        return default
    try:
        return float(val)
    except:
        return default

def safe_str(val, default=''):
    """安全轉換字串"""
    if pd.isna(val):
        return default
    return str(val)

def safe_bool(val):
    """安全轉換布林值"""
    if pd.isna(val):
        return False
    return val == 1 or val == True or val == '1'

def import_top200():
    """匯入 Top200 爆款貼文"""
    print("\n=== 匯入 Top200 爆款貼文 ===")
    
    df = pd.read_excel(EXCEL_FILE, sheet_name='4_Top貼文素材庫_Top200')
    print(f"讀取到 {len(df)} 筆資料")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # 先清空舊的 Top200 資料
    cursor.execute("DELETE FROM viral_examples WHERE source = 'excel_top200'")
    conn.commit()
    
    count = 0
    for _, row in df.iterrows():
        try:
            cursor.execute("""
                INSERT INTO viral_examples 
                (keyword, postText, likes, likesPerDay, postDate, account, threadUrl, 
                 funnelStage, opener50, charLen,
                 hasNumber, questionMark, exclaimMark, youFlag, iFlag, ctaFlag, 
                 timePressureFlag, resultFlag, turnFlag, isTop200, isTop20, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                safe_str(row.get('keyword')),
                safe_str(row.get('post_text')),
                safe_int(row.get('likes')),
                safe_float(row.get('likes_per_day')),
                safe_date(row.get('post_date')),
                safe_str(row.get('account')),
                safe_str(row.get('Thread URL')),
                safe_str(row.get('funnel_stage')),
                safe_str(row.get('opener_50')),
                safe_int(row.get('char_len')),
                safe_bool(row.get('has_number')),
                safe_bool(row.get('question_mark')),
                safe_bool(row.get('exclaim_mark')),
                safe_bool(row.get('you_flag')),
                safe_bool(row.get('i_flag')),
                safe_bool(row.get('cta_flag')),
                safe_bool(row.get('time_pressure_flag')),
                safe_bool(row.get('result_flag')),
                safe_bool(row.get('turn_flag')),
                True,  # isTop200
                False,  # isTop20
                'excel_top200'
            ))
            count += 1
        except Exception as e:
            print(f"Top200 匯入錯誤: {e}")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"Top200 匯入完成: {count} 筆")
    return count

def import_top20():
    """匯入 Top20_by_Keyword"""
    print("\n=== 匯入 Top20_by_Keyword ===")
    
    df = pd.read_excel(EXCEL_FILE, sheet_name='5_Top20_by_Keyword')
    print(f"讀取到 {len(df)} 筆資料")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # 先清空舊的 Top20 資料
    cursor.execute("DELETE FROM viral_examples WHERE source = 'excel_top20'")
    conn.commit()
    
    count = 0
    for _, row in df.iterrows():
        try:
            # Top20 沒有 opener_50 欄位，所以不包含
            cursor.execute("""
                INSERT INTO viral_examples 
                (keyword, postText, likes, likesPerDay, postDate, account, threadUrl, 
                 funnelStage, cluster, charLen,
                 hasNumber, questionMark, exclaimMark, youFlag, iFlag, ctaFlag, 
                 timePressureFlag, resultFlag, turnFlag, isTop200, isTop20, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                safe_str(row.get('keyword')),
                safe_str(row.get('post_text')),
                safe_int(row.get('likes')),
                safe_float(row.get('likes_per_day')),
                safe_date(row.get('post_date')),
                safe_str(row.get('account')),
                safe_str(row.get('Thread URL')),
                safe_str(row.get('funnel_stage')),
                safe_int(row.get('cluster')) if not pd.isna(row.get('cluster')) else None,
                safe_int(row.get('char_len')),
                safe_bool(row.get('has_number')),
                safe_bool(row.get('question_mark')),
                safe_bool(row.get('exclaim_mark')),
                safe_bool(row.get('you_flag')),
                safe_bool(row.get('i_flag')),
                safe_bool(row.get('cta_flag')),
                safe_bool(row.get('time_pressure_flag')),
                safe_bool(row.get('result_flag')),
                safe_bool(row.get('turn_flag')),
                False,  # isTop200
                True,  # isTop20
                'excel_top20'
            ))
            count += 1
        except Exception as e:
            print(f"Top20 匯入錯誤: {e}")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"Top20 匯入完成: {count} 筆")
    return count

def import_topic_templates():
    """匯入選題模板庫"""
    print("\n=== 匯入選題模板庫 ===")
    
    df = pd.read_excel(EXCEL_FILE, sheet_name='9_選題庫_Cluster模板')
    print(f"讀取到 {len(df)} 筆資料")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # 先清空舊資料
    cursor.execute("DELETE FROM topic_templates WHERE source = 'excel_import'")
    conn.commit()
    
    count = 0
    for _, row in df.iterrows():
        try:
            cursor.execute("""
                INSERT INTO topic_templates (cluster, theme, template, source)
                VALUES (%s, %s, %s, %s)
            """, (
                safe_int(row.get('cluster')) if not pd.isna(row.get('cluster')) else None,
                safe_str(row.get('theme')),
                safe_str(row.get('idea')),
                'excel_import'
            ))
            count += 1
        except Exception as e:
            print(f"選題模板匯入錯誤: {e}")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"選題模板匯入完成: {count} 筆")
    return count

def import_content_clusters():
    """匯入內容群集"""
    print("\n=== 匯入內容群集 ===")
    
    # 讀取群集基本資料
    df_cluster = pd.read_excel(EXCEL_FILE, sheet_name='6_ContentMap_Clusters')
    df_funnel = pd.read_excel(EXCEL_FILE, sheet_name='6B_Cluster_Funnel')
    
    print(f"讀取到 {len(df_cluster)} 個群集")
    
    # 建立漏斗分布 Map
    funnel_map = {}
    for _, row in df_funnel.iterrows():
        funnel_map[row['cluster']] = {
            'tofu': safe_float(row.get('TOFU_share')),
            'mofu': safe_float(row.get('MOFU_share')),
            'bofu': safe_float(row.get('BOFU_share')),
        }
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # 先清空舊資料
    cursor.execute("DELETE FROM content_clusters WHERE source = 'excel_import'")
    conn.commit()
    
    count = 0
    for _, row in df_cluster.iterrows():
        cluster_id = safe_int(row.get('cluster'))
        funnel = funnel_map.get(cluster_id, {})
        try:
            cursor.execute("""
                INSERT INTO content_clusters 
                (clusterId, themeKeywords, postsCount, top10Rate, medianLikes, medianLpd, topTerms,
                 tofuShare, mofuShare, bofuShare, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                cluster_id,
                safe_str(row.get('cluster_theme_keywords')),
                safe_int(row.get('posts')),
                safe_float(row.get('top10_rate')),
                safe_int(row.get('median_likes')),
                safe_float(row.get('median_lpd')),
                safe_str(row.get('top_terms')),
                funnel.get('tofu', 0),
                funnel.get('mofu', 0),
                funnel.get('bofu', 0),
                'excel_import'
            ))
            count += 1
        except Exception as e:
            print(f"群集匯入錯誤: {e}")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"內容群集匯入完成: {count} 筆")
    return count

def verify_import():
    """驗證匯入結果"""
    print("\n=== 驗證匯入結果 ===")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM viral_examples")
    viral_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM viral_examples WHERE isTop200 = 1")
    top200_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM viral_examples WHERE isTop20 = 1")
    top20_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM topic_templates")
    template_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM content_clusters")
    cluster_count = cursor.fetchone()[0]
    
    cursor.close()
    conn.close()
    
    print(f"viral_examples 總數: {viral_count}")
    print(f"  - Top200: {top200_count}")
    print(f"  - Top20: {top20_count}")
    print(f"topic_templates: {template_count}")
    print(f"content_clusters: {cluster_count}")
    
    return {
        'viral_examples': viral_count,
        'top200': top200_count,
        'top20': top20_count,
        'topic_templates': template_count,
        'content_clusters': cluster_count
    }

def main():
    print("開始匯入爆款數據優化系統數據...")
    print(f"Excel 檔案: {EXCEL_FILE}")
    
    try:
        # 測試連線
        conn = get_connection()
        conn.close()
        print("資料庫連線成功")
        
        # 匯入各類數據
        top200_count = import_top200()
        top20_count = import_top20()
        template_count = import_topic_templates()
        cluster_count = import_content_clusters()
        
        # 統計結果
        print("\n========================================")
        print("匯入完成！統計結果：")
        print(f"- Top200 爆款貼文: {top200_count} 筆")
        print(f"- Top20_by_Keyword: {top20_count} 筆")
        print(f"- 選題模板: {template_count} 筆")
        print(f"- 內容群集: {cluster_count} 筆")
        print("========================================")
        
        # 驗證
        verify_import()
        
    except Exception as e:
        print(f"匯入失敗: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
