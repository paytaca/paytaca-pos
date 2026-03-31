from patchwork.transfers import rsync
from fabric import task
from fabric.connection import Connection
from dotenv import load_dotenv
import os

load_dotenv()

HOST = os.getenv("HOST")
CHIPNET_HOST = os.getenv("CHIPNET_HOST")
USER = os.getenv("DEPLOY_USER")

DEPLOY_PATH = "/root/paytaca-pos"
CONTAINER_NAME = "paytaca-pos"


def get_connection(network):
    host = HOST if network == "mainnet" else CHIPNET_HOST
    if not host:
        raise Exception(f"Host not configured for {network}. Set CHIPNET_HOST in .env")
    return Connection(
        host,
        user=USER,
        connect_kwargs={"key_filename": os.path.expanduser("~/.ssh/id_rsa")},
    )


@task
def mainnet(ctx):
    ctx.config.run.env["network"] = "mainnet"
    ctx.config.run.env["conn"] = get_connection("mainnet")


@task
def chipnet(ctx):
    ctx.config.run.env["network"] = "chipnet"
    ctx.config.run.env["conn"] = get_connection("chipnet")


@task
def sync(ctx):
    conn = ctx.config.run.env["conn"]
    rsync(
        conn,
        ".",
        DEPLOY_PATH,
        exclude=[
            ".git",
            ".venv",
            ".DS_Store",
            "dist",
            "node_modules",
            "/.env",
            "__pycache__",
            "supervisord.pid",
            "src-capacitor",
            "android",
            "ios",
        ],
    )


@task
def build(ctx):
    conn = ctx.config.run.env["conn"]
    with conn.cd(f"{DEPLOY_PATH}/deployment"):
        conn.run(f"docker-compose -p {CONTAINER_NAME} -f prod.yml build")


@task
def up(ctx):
    conn = ctx.config.run.env["conn"]
    with conn.cd(f"{DEPLOY_PATH}/deployment"):
        conn.run(f"docker-compose -p {CONTAINER_NAME} -f prod.yml up -d")


@task
def down(ctx):
    conn = ctx.config.run.env["conn"]
    with conn.cd(f"{DEPLOY_PATH}/deployment"):
        conn.run(f"docker-compose -p {CONTAINER_NAME} -f prod.yml down")


@task
def deploy(ctx):
    sync(ctx)
    build(ctx)
    down(ctx)
    up(ctx)


@task
def logs(ctx):
    conn = ctx.config.run.env["conn"]
    with conn.cd(f"{DEPLOY_PATH}/deployment"):
        conn.run(f"docker-compose -f prod.yml -p {CONTAINER_NAME} logs -f")
