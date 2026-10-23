<!--
	Maqueta — Administración de usuarios (superadministrador). PRD RF-01..RF-03.

	Pantalla sin funcionamiento, con datos de ejemplo: muestra cómo el portal creará cuentas, asignará
	organización y rol, y bloqueará el acceso, tareas que hoy se hacen desde la interfaz nativa de CKAN.
	`?vista=nuevo` abre el formulario de alta, para capturar ese estado por separado.
-->
<script lang="ts">
import { Ban, MoreHorizontal, Search, UserPlus, Users, X } from "@lucide/svelte";
import { get } from "svelte/store";
import { page } from "$app/stores";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import Card from "$lib/components/ui/card/card.svelte";

type Role = "Superadministrador" | "Administrador de organización" | "Editor" | "Lector";
type State = "Activo" | "Bloqueado";

interface MockUser {
	name: string;
	email: string;
	org: string;
	role: Role;
	state: State;
	lastSeen: string;
}

const USERS: MockUser[] = [
	{
		name: "María Fernanda Rojas Vargas",
		email: "mf.rojas@umss.edu.bo",
		org: "Dirección de Investigación",
		role: "Administrador de organización",
		state: "Activo",
		lastSeen: "Hoy, 09:42",
	},
	{
		name: "Jorge Luis Mamani Quispe",
		email: "jl.mamani@umss.edu.bo",
		org: "Facultad de Ciencias y Tecnología",
		role: "Editor",
		state: "Activo",
		lastSeen: "Ayer",
	},
	{
		name: "Ana Gabriela Céspedes",
		email: "a.cespedes@umss.edu.bo",
		org: "Facultad de Ciencias de la Salud",
		role: "Editor",
		state: "Activo",
		lastSeen: "Hace 3 días",
	},
	{
		name: "Carlos Eduardo Villarroel",
		email: "c.villarroel@umss.edu.bo",
		org: "Rectorado UMSS",
		role: "Superadministrador",
		state: "Activo",
		lastSeen: "Hoy, 08:15",
	},
	{
		name: "Lucía Andrea Torrico",
		email: "l.torrico@umss.edu.bo",
		org: "Facultad de Ciencias Agrícolas",
		role: "Lector",
		state: "Activo",
		lastSeen: "Hace 1 semana",
	},
	{
		name: "Rodrigo Antezana Flores",
		email: "r.antezana@umss.edu.bo",
		org: "Facultad de Ciencias y Tecnología",
		role: "Administrador de organización",
		state: "Activo",
		lastSeen: "Hace 2 días",
	},
	{
		name: "Patricia Soliz Herrera",
		email: "p.soliz@umss.edu.bo",
		org: "Facultad de Ciencias de la Salud",
		role: "Editor",
		state: "Bloqueado",
		lastSeen: "Hace 4 meses",
	},
	{
		name: "Diego Alejandro Paz",
		email: "d.paz@umss.edu.bo",
		org: "Dirección de Investigación",
		role: "Lector",
		state: "Activo",
		lastSeen: "Hace 5 días",
	},
];

const ORGS = [
	"Dirección de Investigación",
	"Facultad de Ciencias Agrícolas",
	"Facultad de Ciencias de la Salud",
	"Facultad de Ciencias y Tecnología",
	"Rectorado UMSS",
];
const ROLES: Role[] = ["Lector", "Editor", "Administrador de organización", "Superadministrador"];

let creating = $state(get(page).url.searchParams.get("vista") === "nuevo");

function initials(name: string): string {
	return name
		.split(" ")
		.slice(0, 2)
		.map((part) => part[0])
		.join("");
}

const selectClass =
	"h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const inputClass =
	"h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-primary placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
</script>

<svelte:head>
	<title>Usuarios — UMSS</title>
</svelte:head>

<div class="min-h-screen bg-background font-sans text-foreground">
	<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
		<Breadcrumb items={[{ label: "Panel", href: "/dashboard" }, { label: "Usuarios" }]} icon={Users} />

		<header class="mt-5 flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="font-heading text-3xl font-bold text-primary sm:text-4xl">Usuarios</h1>
				<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Cree las cuentas de la plataforma, asigne a cada persona su organización y su rol, y
					bloquee el acceso cuando corresponda.
				</p>
			</div>
			<Button onclick={() => (creating = true)}>
				<UserPlus class="size-4" aria-hidden="true" />
				Nuevo usuario
			</Button>
		</header>

		<Card class="mt-6 p-5">
			<div class="flex flex-wrap items-center gap-3">
				<label class="relative min-w-64 flex-1">
					<span class="sr-only">Buscar usuarios</span>
					<Search
						class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<input class="{inputClass} pl-9" placeholder="Buscar por nombre o correo" />
				</label>
				<select class={selectClass} aria-label="Organización">
					<option>Todas las organizaciones</option>
					{#each ORGS as org (org)}
						<option>{org}</option>
					{/each}
				</select>
				<select class={selectClass} aria-label="Rol">
					<option>Todos los roles</option>
					{#each ROLES as role (role)}
						<option>{role}</option>
					{/each}
				</select>
				<select class={selectClass} aria-label="Estado">
					<option>Todos los estados</option>
					<option>Activo</option>
					<option>Bloqueado</option>
				</select>
			</div>

			<div class="mt-5 overflow-x-auto">
				<table class="w-full min-w-[56rem] text-left text-sm">
					<thead class="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
						<tr>
							<th class="py-3 pr-4 font-medium">Usuario</th>
							<th class="py-3 pr-4 font-medium">Organización principal</th>
							<th class="py-3 pr-4 font-medium">Rol</th>
							<th class="py-3 pr-4 font-medium">Estado</th>
							<th class="py-3 pr-4 font-medium">Último acceso</th>
							<th class="py-3 font-medium"><span class="sr-only">Acciones</span></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each USERS as user (user.email)}
							<tr>
								<td class="py-3 pr-4">
									<div class="flex items-center gap-3">
										<span
											class="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
											aria-hidden="true">{initials(user.name)}</span
										>
										<div>
											<p class="font-medium text-primary">{user.name}</p>
											<p class="font-mono text-xs text-muted-foreground">{user.email}</p>
										</div>
									</div>
								</td>
								<td class="py-3 pr-4 text-foreground">{user.org}</td>
								<td class="py-3 pr-4 text-foreground">{user.role}</td>
								<td class="py-3 pr-4">
									{#if user.state === "Activo"}
										<span
											class="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
											>Activo</span
										>
									{:else}
										<span
											class="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
										>
											<Ban class="size-3" aria-hidden="true" />
											Bloqueado
										</span>
									{/if}
								</td>
								<td class="py-3 pr-4 text-muted-foreground">{user.lastSeen}</td>
								<td class="py-3 text-right">
									<button
										class="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
										aria-label="Acciones para {user.name}"
									>
										<MoreHorizontal class="size-4" aria-hidden="true" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
				<p>Mostrando 1–8 de 128 usuarios</p>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" disabled>Anterior</Button>
					<Button variant="outline" size="sm">Siguiente</Button>
				</div>
			</div>
		</Card>
	</div>
</div>

{#if creating}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
		<div
			class="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg"
			role="dialog"
			aria-modal="true"
			aria-labelledby="new-user-title"
		>
			<div class="flex items-start justify-between gap-4">
				<div>
					<h2 id="new-user-title" class="font-heading text-2xl font-semibold text-primary">
						Nuevo usuario
					</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						La persona recibirá un correo para definir su contraseña.
					</p>
				</div>
				<button
					class="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
					aria-label="Cerrar"
					onclick={() => (creating = false)}
				>
					<X class="size-4" aria-hidden="true" />
				</button>
			</div>

			<form class="mt-6 space-y-4" onsubmit={(event) => event.preventDefault()}>
				<label class="block space-y-1.5">
					<span class="text-sm font-medium text-primary">Nombre completo</span>
					<input class={inputClass} value="Valeria Montaño Ríos" />
				</label>
				<label class="block space-y-1.5">
					<span class="text-sm font-medium text-primary">Correo institucional</span>
					<input class={inputClass} type="email" value="v.montano@umss.edu.bo" />
				</label>
				<div class="grid gap-4 sm:grid-cols-2">
					<label class="block space-y-1.5">
						<span class="text-sm font-medium text-primary">Organización principal</span>
						<select class="{selectClass} w-full">
							{#each ORGS as org (org)}
								<option selected={org === "Facultad de Ciencias y Tecnología"}>{org}</option>
							{/each}
						</select>
					</label>
					<label class="block space-y-1.5">
						<span class="text-sm font-medium text-primary">Rol</span>
						<select class="{selectClass} w-full">
							{#each ROLES as role (role)}
								<option selected={role === "Editor"}>{role}</option>
							{/each}
						</select>
					</label>
				</div>
				<p class="rounded-lg bg-accent/60 p-3 text-xs leading-relaxed text-accent-foreground">
					El rol se aplica en la organización elegida. Los permisos sobre un dataset concreto se
					asignan después, desde sus colaboradores.
				</p>
				<div class="flex justify-end gap-2 pt-2">
					<Button variant="outline" type="button" onclick={() => (creating = false)}>
						Cancelar
					</Button>
					<Button type="submit">Crear usuario</Button>
				</div>
			</form>
		</div>
	</div>
{/if}
